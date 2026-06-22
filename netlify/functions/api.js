import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Only once in serverless execution environment)
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (err) {
    console.error('Failed to initialize Firebase Admin. Error:', err);
    console.error('Please ensure FIREBASE_SERVICE_ACCOUNT is set correctly in Netlify.');
  }
}

const db = getApps().length > 0 ? getFirestore() : null;

// In memory store for PKCE verifiers (Note: in a true serverless environment across multiple instances, 
// this could fail if the callback hits a different lambda instance. We will keep it for simplicity as Netlify functions 
// usually reuse instances for back-to-back requests).
let pkceStore = {};

function base64URLEncode(str) {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Config Helpers
async function getConfig(key) {
  if (!db) return null;
  try {
    const doc = await db.collection('config').doc(key).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

async function saveConfig(key, data) {
  if (!db) return;
  await db.collection('config').doc(key).set(data, { merge: true });
}

async function deleteConfig(key) {
  if (!db) return;
  await db.collection('config').doc(key).delete();
}

async function getTokens(provider = 'spotify') {
  return await getConfig(`${provider}_tokens`);
}

async function saveTokens(tokens, provider = 'spotify') {
  await saveConfig(`${provider}_tokens`, tokens);
}

async function getHistory() {
  if (!db) return [];
  try {
    const snapshot = await db.collection('history').orderBy('timestamp', 'asc').get();
    const history = [];
    snapshot.forEach(doc => history.push(doc.data()));
    return history;
  } catch (err) {
    console.error('Error fetching history from Firestore:', err);
    return [];
  }
}

async function saveHistoryItems(newPlays) {
  if (!db) return 0;
  let addedCount = 0;
  try {
    // We should use a batch, but Firestore limits to 500 writes per batch.
    // For simplicity, we'll write individually with a check, or query existing ids.
    // Given the scale, fetching recent history to check ids might be better.
    
    const batch = db.batch();
    let currentBatchSize = 0;
    
    // Just blindly write them. If ID is the doc name, it will just overwrite duplicates perfectly!
    for (const play of newPlays) {
      const docRef = db.collection('history').doc(play.id);
      batch.set(docRef, play, { merge: true }); // Merge ensures we just overwrite identical IDs
      addedCount++;
      currentBatchSize++;
      
      if (currentBatchSize >= 490) {
        await batch.commit();
        currentBatchSize = 0;
      }
    }
    
    if (currentBatchSize > 0) {
      await batch.commit();
    }
    
    return addedCount;
  } catch (err) {
    console.error('Error saving history to Firestore:', err);
    return 0;
  }
}

// ----------------------------------------
// SPOTIFY OAUTH ROUTES
// ----------------------------------------

app.get('/api/auth/spotify', async (req, res) => {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  // Use dynamically constructed redirect URI for Netlify environments
  const redirect_uri = `https://${req.headers.host}/api/auth/spotify/callback`;
  
  if (!client_id || client_id === 'YOUR_SPOTIFY_CLIENT_ID') {
    return res.status(400).send('Please configure your SPOTIFY_CLIENT_ID in the Netlify environment variables.');
  }

  const scope = 'user-read-recently-played';
  const state = Math.random().toString(36).substring(7);

  const authUrl = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }).toString();

  res.redirect(authUrl);
});

app.get('/api/auth/spotify/callback', async (req, res) => {
  const code = req.query.code || null;
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = `https://${req.headers.host}/api/auth/spotify/callback`;

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      }).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      }
    });

    const tokens = response.data;
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    await saveTokens(tokens);

    res.redirect('/#connected');
  } catch (error) {
    console.error('OAuth token exchange error:', error.response?.data || error.message);
    res.status(500).send('Error exchanging auth code: ' + (error.response?.data?.error_description || error.message));
  }
});

async function getActiveAccessToken() {
  const tokens = await getTokens();
  if (!tokens) return null;

  if (Date.now() >= tokens.expires_at - 60000) {
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

    try {
      const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token
        }).toString(),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
        }
      });

      const newTokens = {
        ...tokens,
        access_token: response.data.access_token,
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };
      
      await saveTokens(newTokens);
      return newTokens.access_token;
    } catch (err) {
      console.error('Failed to refresh Spotify token:', err.response?.data || err.message);
      return null;
    }
  }

  return tokens.access_token;
}

// ----------------------------------------
// TIDAL OAUTH ROUTES
// ----------------------------------------

app.get('/api/auth/tidal', (req, res) => {
  const client_id = process.env.TIDAL_CLIENT_ID;
  const redirect_uri = `https://${req.headers.host}/api/auth/tidal/callback`;
  
  if (!client_id || client_id === 'YOUR_TIDAL_CLIENT_ID') {
    return res.status(400).send('Please configure your TIDAL_CLIENT_ID.');
  }

  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(sha256(verifier));
  
  const state = Math.random().toString(36).substring(7);
  pkceStore[state] = verifier;

  const authUrl = 'https://login.tidal.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: client_id,
      redirect_uri: redirect_uri,
      scope: 'r_usr',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).toString();

  res.redirect(authUrl);
});

app.get('/api/auth/tidal/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const client_id = process.env.TIDAL_CLIENT_ID;
  const client_secret = process.env.TIDAL_CLIENT_SECRET;
  const redirect_uri = `https://${req.headers.host}/api/auth/tidal/callback`;

  const verifier = pkceStore[state];
  if (!verifier) {
     return res.status(400).send('Invalid state or missing PKCE verifier. Serverless environment may have dropped memory state.');
  }
  delete pkceStore[state];

  try {
    const response = await axios({
      method: 'post',
      url: 'https://auth.tidal.com/v1/oauth2/token',
      data: new URLSearchParams({
        client_id: client_id,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        code_verifier: verifier
      }).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      }
    });

    const tokens = response.data;
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    await saveTokens(tokens, 'tidal');

    res.redirect('/#connected');
  } catch (error) {
    console.error('Tidal OAuth error:', error.response?.data || error.message);
    res.status(500).send('Error exchanging auth code: ' + (error.response?.data?.error_description || error.message));
  }
});

async function getActiveTidalToken() {
  const tokens = await getTokens('tidal');
  if (!tokens) return null;

  if (Date.now() >= tokens.expires_at - 60000) {
    const client_id = process.env.TIDAL_CLIENT_ID;
    const client_secret = process.env.TIDAL_CLIENT_SECRET;

    try {
      const response = await axios({
        method: 'post',
        url: 'https://auth.tidal.com/v1/oauth2/token',
        data: new URLSearchParams({
          client_id: client_id,
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token
        }).toString(),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
        }
      });

      const newTokens = {
        ...tokens,
        access_token: response.data.access_token,
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };
      
      await saveTokens(newTokens, 'tidal');
      return newTokens.access_token;
    } catch (err) {
      console.error('Failed to refresh Tidal token:', err.response?.data || err.message);
      return null;
    }
  }

  return tokens.access_token;
}

// ----------------------------------------
// API ENDPOINTS
// ----------------------------------------

app.post('/api/config/:platform', async (req, res) => {
  const { platform } = req.params;
  const { clientId, clientSecret } = req.body;
  
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing client credentials' });
  }

  await saveConfig(`${platform}_credentials`, {
    clientId,
    clientSecret
  });

  res.json({ success: true });
});

app.get('/api/status', async (req, res) => {
  const spotifyTokens = await getTokens('spotify');
  const tidalTokens = await getTokens('tidal');
  const lastfmCreds = await getConfig('lastfm_credentials');

  res.json({
    spotify: {
      connected: !!spotifyTokens,
      configured: process.env.SPOTIFY_CLIENT_ID !== 'YOUR_SPOTIFY_CLIENT_ID' && !!process.env.SPOTIFY_CLIENT_ID
    },
    tidal: {
      connected: !!tidalTokens,
      configured: process.env.TIDAL_CLIENT_ID !== 'YOUR_TIDAL_CLIENT_ID' && !!process.env.TIDAL_CLIENT_ID
    },
    lastfm: {
      connected: !!lastfmCreds,
      configured: !!lastfmCreds
    }
  });
});

app.get('/api/history', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not initialized' });
  try {
    const data = await getHistory();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read database history' });
  }
});

app.get('/api/sync/spotify', async (req, res) => {
  const token = await getActiveAccessToken();
  if (!token) {
    return res.status(401).json({ error: 'Spotify is not connected or token expired.' });
  }

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const items = response.data.items || [];
    
    const newPlays = items.map(item => {
      const track = item.track;
      return {
        id: `spotify-${track.id}-${new Date(item.played_at).getTime()}`,
        trackName: track.name,
        artistName: track.artists[0]?.name || 'Unknown Artist',
        albumName: track.album?.name || 'Unknown Album',
        durationMs: track.duration_ms,
        timestamp: item.played_at,
        platform: 'spotify',
        genres: ['Pop', 'Rock', 'Electronic']
      };
    });

    const added = await saveHistoryItems(newPlays);
    const history = await getHistory();

    res.json({
      success: true,
      added: added,
      total: history.length,
      history: history
    });
  } catch (error) {
    console.error('Spotify sync error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to sync with Spotify API' });
  }
});

app.post('/api/disconnect/spotify', async (req, res) => {
  await deleteConfig('spotify_tokens');
  res.json({ success: true });
});

app.get('/api/sync/tidal', async (req, res) => {
  const token = await getActiveTidalToken();
  if (!token) {
    return res.status(401).json({ error: 'Tidal is not connected or token expired.' });
  }

  try {
    const newPlays = [
      {
        id: `tidal-mock-${Date.now()}-1`,
        trackName: 'Tidal Exclusive Track 1',
        artistName: 'Tidal Artist',
        albumName: 'HiFi Album',
        durationMs: 200000,
        timestamp: new Date().toISOString(),
        platform: 'tidal',
        genres: ['Jazz']
      }
    ];

    const added = await saveHistoryItems(newPlays);
    const history = await getHistory();

    res.json({
      success: true,
      added: added,
      total: history.length,
      history: history
    });
  } catch (error) {
    console.error('Tidal sync error:', error);
    res.status(500).json({ error: 'Failed to sync with Tidal' });
  }
});

app.post('/api/disconnect/tidal', async (req, res) => {
  await deleteConfig('tidal_tokens');
  res.json({ success: true });
});

app.get('/api/sync/lastfm', async (req, res) => {
  const lastfmCreds = await getConfig('lastfm_credentials');
  
  if (!lastfmCreds || !lastfmCreds.clientId || !lastfmCreds.clientSecret) {
    return res.status(401).json({ error: 'Last.fm is not configured.' });
  }

  const apiKey = lastfmCreds.clientId;
  const username = lastfmCreds.clientSecret;

  try {
    const response = await axios.get(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=200`);
    
    const items = response.data.recenttracks?.track || [];
    const tracksArray = Array.isArray(items) ? items : [items];
    
    const newPlays = tracksArray.map(track => {
      const timestamp = track.date ? new Date(parseInt(track.date.uts) * 1000).toISOString() : new Date().toISOString();
      const mbid = track.mbid || track.name;
      
      return {
        id: `lastfm-${mbid}-${timestamp}`,
        trackName: track.name,
        artistName: track.artist['#text'] || track.artist.name || 'Unknown Artist',
        albumName: track.album['#text'] || track.album.name || 'Unknown Album',
        durationMs: 0,
        timestamp: timestamp,
        platform: 'lastfm',
        genres: ['Unknown'] 
      };
    });

    const added = await saveHistoryItems(newPlays);
    const history = await getHistory();

    res.json({
      success: true,
      added: added,
      total: history.length,
      history: history
    });
  } catch (error) {
    console.error('Last.fm sync error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.message || 'Failed to sync with Last.fm API';
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/disconnect/lastfm', async (req, res) => {
  await deleteConfig('lastfm_credentials');
  res.json({ success: true });
});

app.post('/api/sync/manual', async (req, res) => {
  const { platform, plays } = req.body;
  if (!platform || !plays || !Array.isArray(plays)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const addedCount = await saveHistoryItems(plays);
    const history = await getHistory();
    
    res.json({
      success: true,
      added: addedCount,
      history: history
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Failed to process manual upload' });
  }
});

// Export the serverless handler
export const handler = serverless(app);

import { generateMockHistory } from '../data/mockData.js';

// const API_URL = 'http://localhost:3005/api';
const API_URL = '/api';

// LocalStorage Keys
const KEYS = {
  EXCLUDED_ARTISTS: 'harmony_excluded_artists',
  CONNECTED_PLATFORMS: 'harmony_connected_platforms',
  TIME_FILTER: 'harmony_time_filter',
  CUSTOM_PLAYS: 'harmony_custom_plays'
};

// Initial state load
let excludedArtists = JSON.parse(localStorage.getItem(KEYS.EXCLUDED_ARTISTS)) || [];
let connectedPlatforms = JSON.parse(localStorage.getItem(KEYS.CONNECTED_PLATFORMS)) || {
  spotify: true,
  tidal: true,
  lastfm: true,
  youtube_music: true
};
if (connectedPlatforms.lastfm === undefined) {
  connectedPlatforms.lastfm = true;
  localStorage.setItem(KEYS.CONNECTED_PLATFORMS, JSON.stringify(connectedPlatforms));
}
let activeTimeFilter = localStorage.getItem(KEYS.TIME_FILTER) || 'all'; // '7days' | '30days' | '60days' | 'all'
let customPlays = JSON.parse(localStorage.getItem(KEYS.CUSTOM_PLAYS)) || [];

// Generate initial base history (mock data)
const baseHistory = generateMockHistory();

// Real Spotify listening history loaded from backend
let backendHistory = [];
let backendStatus = {
  spotify: { connected: false, configured: false },
  tidal: { connected: false, configured: false },
  lastfm: { connected: false, configured: false }
};

// Subscribe callback mechanism for reactivity
const subscribers = [];
function notifyStateChange() {
  subscribers.forEach(cb => cb());
}

export function subscribe(callback) {
  subscribers.push(callback);
}

// Initialize Backend Connection
export async function initBackend(forceHistoryFetch = false) {
  try {
    const resStatus = await fetch(`${API_URL}/status`);
    if (resStatus.ok) {
      backendStatus = await resStatus.json();
    }
    
    if (forceHistoryFetch || backendHistory.length === 0) {
      const resHist = await fetch(`${API_URL}/history`);
      if (resHist.ok) {
        backendHistory = await resHist.json();
      }
    }
    notifyStateChange();
  } catch (err) {
    console.warn('StreamStats Backend is offline or unreachable.');
  }
}

// Getters
export function getExcludedArtists() {
  return [...excludedArtists];
}

export function getConnectedPlatforms() {
  return { ...connectedPlatforms };
}

export function getActiveTimeFilter() {
  return activeTimeFilter;
}

export function getBackendStatus() {
  return backendStatus;
}

// Exclusions management
export function excludeArtist(artistName) {
  const normalized = artistName.trim();
  if (normalized && !excludedArtists.includes(normalized)) {
    excludedArtists.push(normalized);
    localStorage.setItem(KEYS.EXCLUDED_ARTISTS, JSON.stringify(excludedArtists));
    notifyStateChange();
  }
}

export function includeArtist(artistName) {
  excludedArtists = excludedArtists.filter(name => name !== artistName);
  localStorage.setItem(KEYS.EXCLUDED_ARTISTS, JSON.stringify(excludedArtists));
  notifyStateChange();
}

// Connection management
export function togglePlatform(platform) {
  if (platform in connectedPlatforms) {
    connectedPlatforms[platform] = !connectedPlatforms[platform];
    localStorage.setItem(KEYS.CONNECTED_PLATFORMS, JSON.stringify(connectedPlatforms));
    notifyStateChange();
  }
}

// Time filter management
export function setTimeFilter(filter) {
  activeTimeFilter = filter;
  localStorage.setItem(KEYS.TIME_FILTER, filter);
  notifyStateChange();
}

// Spotify Sync Actions
export async function syncSpotify() {
  try {
    const response = await fetch(`${API_URL}/sync/spotify`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to sync with Spotify');
    }
    const result = await response.json();
    backendHistory = result.history;
    notifyStateChange();
    return { success: true, added: result.added };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function disconnectSpotify() {
  try {
    const response = await fetch(`${API_URL}/disconnect/spotify`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to disconnect');
    
    backendStatus.spotify.connected = false;
    backendHistory = backendHistory.filter(item => item.platform !== 'spotify');
    notifyStateChange();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Tidal Sync Actions
export async function syncTidal() {
  try {
    const response = await fetch(`${API_URL}/sync/tidal`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to sync with Tidal');
    }
    const result = await response.json();
    backendHistory = result.history;
    notifyStateChange();
    return { success: true, added: result.added };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function disconnectTidal() {
  try {
    const response = await fetch(`${API_URL}/disconnect/tidal`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to disconnect');
    
    backendStatus.tidal.connected = false;
    backendHistory = backendHistory.filter(item => item.platform !== 'tidal');
    notifyStateChange();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Last.fm Sync Actions
export async function syncLastfm() {
  try {
    const response = await fetch(`${API_URL}/sync/lastfm`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to sync with Last.fm');
    }
    const result = await response.json();
    backendHistory = result.history;
    notifyStateChange();
    return { success: true, added: result.added };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function disconnectLastfm() {
  try {
    const response = await fetch(`${API_URL}/disconnect/lastfm`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to disconnect');
    
    backendStatus.lastfm.connected = false;
    backendStatus.lastfm.configured = false;
    backendHistory = backendHistory.filter(item => item.platform !== 'lastfm');
    notifyStateChange();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Manual JSON Upload Sync
export async function syncManualUpload(platform, plays) {
  try {
    const response = await fetch(`${API_URL}/sync/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, plays })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to sync manual upload');
    }
    const result = await response.json();
    backendHistory = result.history;
    notifyStateChange();
    return { success: true, added: result.added };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function savePlatformConfig(platform, clientId, clientSecret) {
  try {
    const response = await fetch(`${API_URL}/config/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret })
    });
    if (!response.ok) throw new Error('Failed to save configuration');
    
    // Refresh backend status to pick up the new configuration state
    await initBackend();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Import Custom Plays
export function importData(jsonData) {
  try {
    const parsed = Array.isArray(jsonData) ? jsonData : JSON.parse(jsonData);
    const cleaned = parsed.map((item, idx) => {
      let trackName, artistName, albumName, durationMs, timestamp, platform;

      if ((item.header === 'YouTube Music' || item.header === 'YouTube') && item.title && item.title.startsWith('Watched ')) {
        // YouTube Music Takeout Format
        trackName = item.title.replace(/^Watched\s+/i, '');
        artistName = item.subtitles?.[0]?.name || 'Unknown Artist';
        // Clean up common YouTube Music channel suffixes
        if (artistName.endsWith(' - Topic')) {
          artistName = artistName.replace(' - Topic', '');
        }
        albumName = 'Unknown Album';
        durationMs = 180000; // Duration is not provided in Takeout
        timestamp = item.time;
        platform = 'youtube_music';
      } else {
        // Default / Spotify GDPR Format
        trackName = item.trackName || item.master_metadata_track_name || item.track || item.name || 'Unknown Track';
        artistName = item.artistName || item.master_metadata_album_artist_name || item.artist || 'Unknown Artist';
        albumName = item.albumName || item.master_metadata_album_album_name || item.album || 'Unknown Album';
        durationMs = Number(item.durationMs || item.ms_played || item.duration_ms || item.duration) || 180000;
        timestamp = item.timestamp || item.ts || item.endTime || item.time || Date.now();
        platform = item.platform || 'spotify';
      }

      return {
        id: `imported-${Date.now()}-${idx}`,
        trackName,
        artistName,
        albumName,
        durationMs,
        timestamp: new Date(timestamp).toISOString(),
        platform,
        genres: Array.isArray(item.genres) ? item.genres : [item.genre || 'Other']
      };
    });
    customPlays = [...customPlays, ...cleaned];
    localStorage.setItem(KEYS.CUSTOM_PLAYS, JSON.stringify(customPlays));
    notifyStateChange();
    return { success: true, count: cleaned.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function resetAllData() {
  excludedArtists = [];
  connectedPlatforms = { spotify: true, tidal: true, youtube_music: true };
  activeTimeFilter = 'all';
  customPlays = [];
  localStorage.removeItem(KEYS.EXCLUDED_ARTISTS);
  localStorage.removeItem(KEYS.CONNECTED_PLATFORMS);
  localStorage.removeItem(KEYS.TIME_FILTER);
  localStorage.removeItem(KEYS.CUSTOM_PLAYS);
  notifyStateChange();
}

// Helper to filter data by active criteria
export function getFilteredListeningHistory() {
  // If real APIs are connected, replace mock history with the real backendHistory
  let activeBaseHistory = baseHistory;
  if (backendStatus.spotify.connected) {
    activeBaseHistory = activeBaseHistory.filter(item => item.platform !== 'spotify');
  }
  if (backendStatus.tidal.connected) {
    activeBaseHistory = activeBaseHistory.filter(item => item.platform !== 'tidal');
  }

  let allData = [...activeBaseHistory, ...backendHistory, ...customPlays];
  
  // Deduplicate Last.fm tracks: Since Last.fm tracks everything, we use it only as a proxy for Tidal.
  // Any Last.fm track that has a corresponding Spotify or YouTube Music track within a 15-minute window
  // is removed, leaving ONLY the true Tidal plays.
  const nonLastFmPlays = allData.filter(item => item.platform !== 'lastfm');
  
  // Set boundary for "today" to ignore Last.fm historical plays
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  allData = allData.filter(item => {
    if (item.platform !== 'lastfm') return true;
    
    const itemTime = new Date(item.timestamp).getTime();
    
    // 1. Ignore Last.fm historical plays (before today)
    if (itemTime < startOfToday.getTime()) {
      return false;
    }
    
    // 2. Check if there is a matching play on another platform within 15 minutes (900000 ms)
    const isDuplicate = nonLastFmPlays.some(other => {
      if (other.trackName.toLowerCase() !== item.trackName.toLowerCase()) return false;
      const otherTime = new Date(other.timestamp).getTime();
      return Math.abs(itemTime - otherTime) < 900000;
    });
    
    return !isDuplicate;
  });

  const now = new Date();

  return allData.filter(item => {
    // 1. Connection filter
    if (!connectedPlatforms[item.platform]) return false;

    // 2. Exclusion filter (case-insensitive)
    const isExcluded = excludedArtists.some(
      ex => ex.toLowerCase() === item.artistName.toLowerCase()
    );
    if (isExcluded) return false;

    // 3. Time filter
    const itemDate = new Date(item.timestamp);
    if (activeTimeFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (itemDate < sevenDaysAgo) return false;
    } else if (activeTimeFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (itemDate < thirtyDaysAgo) return false;
    } else if (activeTimeFilter === '60days') {
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      if (itemDate < sixtyDaysAgo) return false;
    } else if (activeTimeFilter.startsWith('year-')) {
      const year = parseInt(activeTimeFilter.split('-')[1], 10);
      if (itemDate.getFullYear() !== year) return false;
    }

    // 4. Duration filter (industry standard 30-second minimum for a stream to count)
    if (item.durationMs < 30000) return false;

    return true;
  });
}

// Stats computations
export function getStats() {
  const filtered = getFilteredListeningHistory();

  let activeBaseHistory = baseHistory;
  if (backendStatus.spotify.connected) {
    activeBaseHistory = activeBaseHistory.filter(item => item.platform !== 'spotify');
  }
  if (backendStatus.tidal.connected) {
    activeBaseHistory = activeBaseHistory.filter(item => item.platform !== 'tidal');
  }
  const rawData = [...activeBaseHistory, ...backendHistory, ...customPlays];

  // Calculate total excluded count and duration
  let excludedPlayCount = 0;
  let excludedDurationMs = 0;

  rawData.forEach(item => {
    const matchesPlatform = connectedPlatforms[item.platform];
    const isExcluded = excludedArtists.some(
      ex => ex.toLowerCase() === item.artistName.toLowerCase()
    );
    
    if (matchesPlatform && isExcluded) {
      excludedPlayCount++;
      excludedDurationMs += item.durationMs;
    }
  });

  const totalDurationMs = filtered.reduce((acc, curr) => acc + curr.durationMs, 0);

  // Compute platform distribution
  const platformCounts = { spotify: 0, tidal: 0, youtube_music: 0, lastfm: 0 };
  filtered.forEach(item => {
    if (item.platform in platformCounts) {
      platformCounts[item.platform]++;
    }
  });

  // Top artists
  const artistData = {};
  filtered.forEach(item => {
    if (!artistData[item.artistName]) {
      artistData[item.artistName] = { count: 0, duration: 0 };
    }
    artistData[item.artistName].count++;
    artistData[item.artistName].duration += item.durationMs;
  });

  const sortedArtists = Object.entries(artistData)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // Top tracks
  const trackData = {};
  filtered.forEach(item => {
    const key = `${item.trackName} - ${item.artistName}`;
    if (!trackData[key]) {
      trackData[key] = {
        title: item.trackName,
        artist: item.artistName,
        platform: item.platform,
        count: 0
      };
    }
    trackData[key].count++;
  });

  const sortedTracks = Object.values(trackData)
    .sort((a, b) => b.count - a.count);

  // Top genres
  const genreData = {};
  filtered.forEach(item => {
    (item.genres || []).forEach(g => {
      genreData[g] = (genreData[g] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreData)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPlays: filtered.length,
    totalMinutes: Math.round(totalDurationMs / 60000),
    uniqueArtists: sortedArtists.length,
    excludedPlayCount,
    excludedMinutes: Math.round(excludedDurationMs / 60000),
    topArtists: sortedArtists,
    topTracks: sortedTracks,
    topGenres: sortedGenres,
    platformCounts
  };
}

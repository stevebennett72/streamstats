import * as state from './state.js';
import * as charts from './charts.js';
import { AUTO_EXCLUDE_SUGGESTIONS } from '../data/mockData.js';

// DOM Elements
const views = {
  dashboard: document.getElementById('view-dashboard'),
  exclusions: document.getElementById('view-exclusions'),
  connections: document.getElementById('view-connections'),
  explorer: document.getElementById('view-explorer')
};

const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const navItems = document.querySelectorAll('.nav-item');

// Active view state
let activeView = 'dashboard';

// Pagination state for Explorer
let explorerPage = 1;
const ITEMS_PER_PAGE = 15;
let explorerSearchQuery = '';
let explorerActiveFilters = { platform: null, date: null };

// Global method for cross-component navigation
window.exploreData = (filters) => {
  explorerActiveFilters = { ...explorerActiveFilters, ...filters };
  explorerPage = 1;
  
  // Switch to explorer tab
  navItems.forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-target="explorer"]').classList.add('active');
  activeView = 'explorer';
  updateViewVisibility();
  
  // Re-render table
  renderExplorer();
  
  // Scroll to top to see it
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.clearExplorerFilter = (key) => {
  explorerActiveFilters[key] = null;
  explorerPage = 1;
  renderExplorer();
};

// Setup Routing
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    
    activeView = item.getAttribute('data-target');
    updateViewVisibility();
  });
});

function updateViewVisibility() {
  Object.keys(views).forEach(k => {
    if (k === activeView) {
      views[k].classList.add('active');
    } else {
      views[k].classList.remove('active');
    }
  });

  // Header update based on view
  if (activeView === 'dashboard') {
    pageTitle.innerText = 'Dashboard Overview';
    pageSubtitle.innerText = 'Aggregated listening history and statistics';
    document.querySelector('.controls-bar').style.display = 'flex';
  } else if (activeView === 'exclusions') {
    pageTitle.innerText = 'Artist Exclusions';
    pageSubtitle.innerText = 'Manage filtered artists and children tracks';
    document.querySelector('.controls-bar').style.display = 'none';
  } else if (activeView === 'connections') {
    pageTitle.innerText = 'Platform Connections';
    pageSubtitle.innerText = 'Manage linked music services and stats sources';
    document.querySelector('.controls-bar').style.display = 'none';
  } else if (activeView === 'explorer') {
    pageTitle.innerText = 'Listening Data Explorer';
    pageSubtitle.innerText = 'Browse individual streams across all timelines';
    document.querySelector('.controls-bar').style.display = 'flex';
  }

  renderActiveView();
}

// Format duration helper (minutes/seconds/hours)
function formatDuration(ms) {
  if (!ms) return '--:--';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 60) {
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} hrs`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')} min`;
}

// ----------------------------------------
// RENDER VIEW: DASHBOARD
// ----------------------------------------
function renderDashboard() {
  const stats = state.getStats();
  const history = state.getFilteredListeningHistory();
  const timeFilter = state.getActiveTimeFilter();

  // Cards
  document.getElementById('stat-total-plays').innerText = stats.totalPlays.toLocaleString();
  document.getElementById('stat-unique-artists').innerText = stats.uniqueArtists.toLocaleString();
  document.getElementById('stat-total-time').innerText = `${stats.totalMinutes.toLocaleString()} min`;
  document.getElementById('stat-excluded-plays').innerText = stats.excludedPlayCount.toLocaleString();
  document.getElementById('stat-excluded-time').innerText = `${stats.excludedMinutes.toLocaleString()} min`;

  // Global variable for tracking how many tracks to show
  if (typeof window.topTracksLimit === 'undefined') {
    window.topTracksLimit = 10;
  }

  window.loadMoreTracks = () => {
    window.topTracksLimit += 10;
    renderActiveView(); // re-render with higher limit
  };

  window.openTrack = (platform, title, artist) => {
    const query = encodeURIComponent(`${title} ${artist}`);
    let url = '#';
    if (platform === 'spotify') {
      url = `https://open.spotify.com/search/${query}`;
    } else if (platform === 'tidal') {
      url = `https://listen.tidal.com/search?q=${query}`;
    } else if (platform === 'youtube_music') {
      url = `https://music.youtube.com/search?q=${query}`;
    }
    if (url !== '#') {
      window.open(url, '_blank');
    }
  };

  // Top Tracks List
  const tracksContainer = document.getElementById('top-tracks-list');
  if (stats.topTracks.length === 0) {
    tracksContainer.innerHTML = '<div class="empty-state" style="padding:2rem;">No plays recorded</div>';
  } else {
    let tracksHtml = stats.topTracks.slice(0, window.topTracksLimit).map((track, i) => `
      <div class="list-item" style="cursor: pointer;" onclick="window.openTrack('${track.platform}', '${track.title.replace(/'/g, "\\'")}', '${track.artist.replace(/'/g, "\\'")}')">
        <div class="item-left">
          <span class="item-index">${i + 1}</span>
          <div class="item-details">
            <div class="item-title">${escapeHTML(track.title)}</div>
            <div class="item-subtitle">${escapeHTML(track.artist)}</div>
          </div>
        </div>
        <div class="item-right">
          <span class="item-stat">${track.count}</span>
          <span class="item-unit">plays</span>
          <div class="item-platform-badge ${track.platform}">
            <i class="ri-${track.platform === 'spotify' ? 'spotify-fill' : (track.platform === 'tidal' ? 'music-fill' : 'youtube-fill')}"></i>
          </div>
        </div>
      </div>
    `).join('');

    if (stats.topTracks.length > window.topTracksLimit) {
      tracksHtml += `
        <div style="display:flex; justify-content:center; margin-top: 1rem;">
          <button class="btn btn-outline" onclick="window.loadMoreTracks()" style="font-size: 0.9rem; padding: 0.5rem 1.5rem;">
            Load More Tracks
          </button>
        </div>
      `;
    }
    
    tracksContainer.innerHTML = tracksHtml;
  }

  // Top Genres List
  const genresContainer = document.getElementById('top-genres-list');
  if (stats.topGenres.length === 0) {
    genresContainer.innerHTML = '<div class="empty-state" style="padding:2rem;">No genre tags found</div>';
  } else {
    genresContainer.innerHTML = stats.topGenres.slice(0, 8).map((genre, i) => `
      <div class="list-item">
        <div class="item-left">
          <span class="item-index">${i + 1}</span>
          <span class="item-title" style="text-transform: capitalize;">${escapeHTML(genre.name)}</span>
        </div>
        <div class="item-right">
          <span class="item-stat">${genre.count}</span>
          <span class="item-unit">plays</span>
        </div>
      </div>
    `).join('');
  }

  // Visualizations
  charts.renderPlatformBreakdown('platform-chart-container', stats.platformCounts);
  charts.renderTimelineChart('timeline-chart-container', history, timeFilter);
}

// Helper for security
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ----------------------------------------
// RENDER VIEW: EXCLUSIONS
// ----------------------------------------
function renderExclusions() {
  const excluded = state.getExcludedArtists();
  const listContainer = document.getElementById('blocked-artists-container');
  const countBadge = document.getElementById('exclusions-count-badge');

  countBadge.innerText = `${excluded.length} Excluded`;

  if (excluded.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 2rem;">
        <i class="ri-user-unfollow-line"></i>
        <h3>No excluded artists</h3>
        <p>Listening statistics are fully unfiltered. Kids music or other tracks will be visible on your timeline.</p>
      </div>
    `;
  } else {
    listContainer.innerHTML = excluded.map(name => `
      <div class="blocked-card">
        <span class="blocked-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
        <button class="remove-btn" data-artist="${escapeHTML(name)}">
          <i class="ri-close-circle-line"></i>
        </button>
      </div>
    `).join('');

    // Wire up delete button actions
    listContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const artist = btn.getAttribute('data-artist');
        state.includeArtist(artist);
      });
    });
  }

  // Populate Auto-Suggestions
  const suggestionsContainer = document.getElementById('suggestions-list-container');
  const availableSuggestions = AUTO_EXCLUDE_SUGGESTIONS.filter(name => !excluded.includes(name));

  if (availableSuggestions.length === 0) {
    suggestionsContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">All detected kids content has been excluded! 🎉</span>';
  } else {
    suggestionsContainer.innerHTML = availableSuggestions.map(name => `
      <button class="suggestion-badge" data-artist="${escapeHTML(name)}">
        <i class="ri-add-circle-line"></i>
        <span>${escapeHTML(name)}</span>
      </button>
    `).join('');

    // Wire up suggestion click action
    suggestionsContainer.querySelectorAll('.suggestion-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        const artist = badge.getAttribute('data-artist');
        state.excludeArtist(artist);
      });
    });
  }
}

// Handle Custom exclusion submit
const exclusionForm = document.getElementById('exclusion-form');
const excludeInput = document.getElementById('exclude-artist-input');
exclusionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const artist = excludeInput.value.trim();
  if (artist) {
    state.excludeArtist(artist);
    excludeInput.value = '';
  }
});

// ----------------------------------------
// RENDER VIEW: CONNECTIONS
// ----------------------------------------
function renderConnections() {
  const container = document.getElementById('platforms-grid-container');
  const bStatus = state.getBackendStatus();
  const connected = state.getConnectedPlatforms();
  const history = state.getFilteredListeningHistory();
  
  // Preserve existing user input text to prevent wiping during background polling
  const existingInputs = {};
  if (container) {
    container.querySelectorAll('input.text-input').forEach(input => {
      existingInputs[input.id] = input.value;
    });
  }

  // Platform play count breakdown
  const counts = { spotify: 0, tidal: 0, youtube_music: 0, lastfm: 0 };
  history.forEach(i => counts[i.platform]++);

  // Spotify live connectivity description
  let spotifyDesc = 'Provides live synchronization of your listening history using Spotify Web API.';
  let spotifyStatusLabel = 'Offline';
  let spotifyStatusClass = 'disconnected';
  let spotifyBtnText = 'Connect Live API';
  let spotifyBtnClass = 'connect-action';
  
  if (bStatus.spotify.connected) {
    spotifyStatusLabel = 'Live Synced';
    spotifyStatusClass = 'connected';
    spotifyBtnText = 'Sync Recent Plays';
    spotifyBtnClass = 'connect-action';
  } else if (!bStatus.spotify.configured) {
    spotifyDesc = 'Please configure your Spotify API credentials to enable live synchronization.';
    spotifyStatusLabel = 'Not Configured';
    spotifyStatusClass = 'disconnected';
  }

  // Tidal live connectivity description
  let tidalDesc = 'Provides live synchronization of your listening history using Tidal OAuth.';
  let tidalStatusLabel = 'Offline';
  let tidalStatusClass = 'disconnected';
  let tidalBtnText = 'Connect Live API';
  let tidalBtnClass = 'connect-action';
  
  if (bStatus.tidal?.connected) {
    tidalStatusLabel = 'Live Synced';
    tidalStatusClass = 'connected';
    tidalBtnText = 'Sync Recent Plays';
    tidalBtnClass = 'connect-action';
  } else if (!bStatus.tidal?.configured) {
    tidalDesc = 'Please configure your Tidal API credentials to enable live synchronization.';
    tidalStatusLabel = 'Not Configured';
    tidalStatusClass = 'disconnected';
  }

  // Last.fm live connectivity description
  let lastfmDesc = 'Provides live synchronization of your listening history using Last.fm scrobbling.';
  let lastfmStatusLabel = 'Offline';
  let lastfmStatusClass = 'disconnected';
  let lastfmBtnText = 'Connect Live API';
  let lastfmBtnClass = 'connect-action';
  
  if (bStatus.lastfm?.connected) {
    lastfmStatusLabel = 'Live Synced';
    lastfmStatusClass = 'connected';
    lastfmBtnText = 'Sync Recent Plays';
    lastfmBtnClass = 'connect-action';
  } else if (!bStatus.lastfm?.configured) {
    lastfmDesc = 'Please configure your Last.fm API Key and Username to enable live synchronization.';
    lastfmStatusLabel = 'Not Configured';
    lastfmStatusClass = 'disconnected';
  }

  const platformsDef = [
    {
      id: 'spotify',
      name: 'Spotify',
      icon: 'spotify-fill',
      color: '#1db954',
      rgb: '29, 185, 84',
      textColor: '#000000',
      desc: 'Connect your Spotify account to sync your entire listening history and top artists.',
      statusLabel: spotifyStatusLabel,
      statusClass: spotifyStatusClass,
      btnClass: spotifyBtnClass,
      isLive: true,
      hasUploadOption: true
    },
    {
      id: 'lastfm',
      name: 'Tidal (via Last.fm)',
      svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z"/></svg>`,
      color: '#000000',
      rgb: '0, 0, 0',
      textColor: '#ffffff',
      statusLabel: lastfmStatusLabel,
      statusClass: lastfmStatusClass,
      btnText: lastfmBtnText,
      btnClass: lastfmBtnClass,
      desc: 'Since Tidal lacks a public history API, connect your Last.fm account (which scrobbles your Tidal plays) to sync your history.',
      isLive: true,
      apiKeyPlaceholder: 'Last.fm API Key',
      apiSecretPlaceholder: 'Last.fm Username',
      secretType: 'text'
    },
    {
      id: 'youtube_music',
      name: 'YouTube Music',
      icon: 'youtube-fill',
      color: '#ff0000',
      rgb: '255, 0, 0',
      textColor: '#ffffff',
      desc: 'Import your Google Takeout watch-history.json file to add your YouTube Music history.',
      statusLabel: connected.youtube_music ? 'Imported' : 'Not Imported',
      statusClass: connected.youtube_music ? 'connected' : 'disconnected',
      btnText: 'Import Takeout JSON',
      btnClass: 'upload-action',
      isLive: true,
      requiresUpload: true
    }
  ];

  container.innerHTML = platformsDef.map(p => {
    const isConfigured = p.isLive ? (bStatus[p.id]?.configured ?? true) : true;
    const isConnected = p.isLive ? (bStatus[p.id]?.connected ?? connected[p.id]) : connected[p.id];
    
    return `
      <div class="platform-card ${isConnected ? 'connected' : ''}" style="--p-color: ${p.color}; --p-color-rgb: ${p.rgb}; --p-text-color: ${p.textColor}">
        <div class="platform-card-header">
          <div class="platform-logo ${p.id}">
            ${p.svgIcon ? p.svgIcon : `<i class="ri-${p.icon}"></i>`}
            <span class="platform-logo-text">${p.name}</span>
          </div>
          <span class="platform-status ${p.statusClass}">
            ${p.statusLabel}
          </span>
        </div>
        
        <p style="color:var(--text-secondary); font-size:0.875rem; min-height:40px;">${p.desc}</p>
        
        ${isConfigured ? `
          <div class="platform-stats-row">
            <div class="platform-stat-item">
              <div class="p-stat-label">Total Syncs</div>
              <div class="p-stat-val">${isConnected ? (counts[p.id] || 0).toLocaleString() : 0}</div>
            </div>
            <div class="platform-stat-item">
              <div class="p-stat-label">Stream Quality</div>
              <div class="p-stat-val" style="font-size:0.9rem;">${p.id === 'tidal' ? 'HiFi Lossless' : '320kbps'}</div>
            </div>
          </div>
          
          <div style="display:flex; gap:0.5rem; margin-top:auto; align-items: center;">
            <button class="platform-connect-btn ${p.btnClass}" data-platform="${p.id}" data-action="${p.requiresUpload ? 'upload' : 'connect'}">
              <i class="ri-${p.requiresUpload ? 'upload-cloud-2-line' : (isConnected ? 'refresh-line' : 'links-line')}"></i>
              <span>${p.btnText}</span>
            </button>
            ${(p.requiresUpload || p.hasUploadOption) ? `<input type="file" id="${p.id}-upload-input" accept=".json" style="display: none;">` : ''}
            
            ${(p.hasUploadOption && isConfigured) ? `
              <button class="platform-connect-btn upload-action" data-platform="${p.id}" data-action="upload" title="Import GDPR History JSON" style="padding: 0.5rem 0.75rem; width: auto; background: rgba(255,255,255,0.1);">
                <i class="ri-upload-cloud-2-line"></i>
              </button>
            ` : ''}

            ${p.isLive && !p.requiresUpload && isConnected ? `
              <button class="platform-connect-btn disconnect-action" data-platform="${p.id}" data-action="disconnect" style="padding: 0.5rem 1rem; width: auto; margin-left: auto;">
                <i class="ri-shut-down-line"></i>
              </button>
            ` : ''}
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:auto;">
            <input type="text" id="${p.id}-client-id" class="text-input" placeholder="${p.apiKeyPlaceholder || 'Client ID'}" style="font-size:0.8rem; padding:0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white;">
            <input type="${p.secretType || 'password'}" id="${p.id}-client-secret" class="text-input" placeholder="${p.apiSecretPlaceholder || 'Client Secret'}" style="font-size:0.8rem; padding:0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white;">
            <button class="platform-connect-btn save-config-btn" data-platform="${p.id}" style="width: 100%; justify-content: center; background: rgba(var(--p-color-rgb), 0.2); color: var(--p-text-color);">
              <i class="ri-save-line"></i>
              <span>Save Configuration</span>
            </button>
          </div>
        `}
      </div>
    `;
  }).join('');

  // Restore existing user input text
  Object.keys(existingInputs).forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = existingInputs[id];
  });

  // Wire config save actions
  container.querySelectorAll('.save-config-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plat = btn.getAttribute('data-platform');
      const clientId = document.getElementById(`${plat}-client-id`).value.trim();
      const clientSecret = document.getElementById(`${plat}-client-secret`).value.trim();
      
      if (!clientId || !clientSecret) {
        showImportFeedback('Please fill in both Client ID and Client Secret', 'rgba(239, 68, 68, 0.15)', '#ef4444');
        return;
      }
      
      btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> <span>Saving...</span>`;
      const res = await state.savePlatformConfig(plat, clientId, clientSecret);
      
      if (res.success) {
        showImportFeedback('Configuration saved successfully!', 'rgba(16, 185, 129, 0.15)', '#10b981');
      } else {
        showImportFeedback(`Failed to save config: ${res.error}`, 'rgba(239, 68, 68, 0.15)', '#ef4444');
        btn.innerHTML = `<i class="ri-save-line"></i> <span>Save Configuration</span>`;
      }
    });
  });

  // Wire connect actions
  container.querySelectorAll('.platform-connect-btn:not(.save-config-btn)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plat = btn.getAttribute('data-platform');
      const action = btn.getAttribute('data-action');

      if (action === 'upload') {
        const fileInput = document.getElementById(`${plat}-upload-input`);
        if (fileInput) fileInput.click();
        return;
      }

      if (plat === 'spotify' || plat === 'tidal' || plat === 'lastfm') {
        if (action === 'disconnect') {
          let res;
          if (plat === 'spotify') res = await state.disconnectSpotify();
          else if (plat === 'tidal') res = await state.disconnectTidal();
          else res = await state.disconnectLastfm();
          
          if (res.success) {
            showImportFeedback(`${plat} disconnected successfully.`, 'rgba(16, 185, 129, 0.15)', '#10b981');
          }
        } else {
          // If already connected, trigger "Sync"
          if (bStatus[plat]?.connected) {
            btn.classList.add('loading');
            btn.querySelector('span').innerText = 'Syncing...';
            
            let syncRes;
            if (plat === 'spotify') syncRes = await state.syncSpotify();
            else if (plat === 'tidal') syncRes = await state.syncTidal();
            else syncRes = await state.syncLastfm();
            
            btn.classList.remove('loading');
            if (syncRes.success) {
              showImportFeedback(`Synced successfully! Added ${syncRes.added} new tracks.`, 'rgba(16, 185, 129, 0.15)', '#10b981');
            } else {
              showImportFeedback(`Sync failed: ${syncRes.error}`, 'rgba(239, 68, 68, 0.15)', '#ef4444');
            }
          } else if (bStatus[plat]?.configured) {
            if (plat === 'lastfm') {
              btn.classList.add('loading');
              btn.querySelector('span').innerText = 'Verifying...';
              const syncRes = await state.syncLastfm();
              btn.classList.remove('loading');
              if (syncRes.success) {
                showImportFeedback(`Last.fm Connected & Synced! Added ${syncRes.added} tracks.`, 'rgba(16, 185, 129, 0.15)', '#10b981');
              } else {
                showImportFeedback(`Connection failed: ${syncRes.error}`, 'rgba(239, 68, 68, 0.15)', '#ef4444');
              }
            } else {
              window.location.href = `/api/auth/${plat}`;
            }
          } else {
            alert(`Please configure your ${plat.toUpperCase()} API details first.`);
          }
        }
      }
    });
  });

  // Wire file upload inputs
  container.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const plat = input.id.split('-')[0]; // e.g. "youtube_music"
      showImportFeedback(`Parsing ${file.name}...`, 'rgba(255, 255, 255, 0.1)', '#fff');
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          let formattedPlays = [];
          
          if (plat === 'youtube_music') {
            const ytMusicPlays = data.filter(item => item.header === 'YouTube Music' || (item.products && item.products.includes('YouTube Music')));
            if (ytMusicPlays.length === 0) {
              showImportFeedback('No YouTube Music history found in this file.', 'rgba(239, 68, 68, 0.15)', '#ef4444');
              return;
            }
            formattedPlays = ytMusicPlays.map(item => {
              let trackName = item.title;
              if (trackName && trackName.startsWith('Watched ')) trackName = trackName.substring(8);
              const artistName = (item.subtitles && item.subtitles.length > 0) ? item.subtitles[0].name : 'Unknown Artist';
              const timestamp = new Date(item.time).getTime();
              return {
                id: `ytmusic-${timestamp}`,
                trackName: trackName || 'Unknown Track',
                artistName: artistName,
                albumName: 'Unknown Album',
                durationMs: 0,
                timestamp: timestamp,
                platform: 'youtube_music',
                genres: ['Unknown']
              };
            });
          } else if (plat === 'spotify') {
            const isSpotify = data.length > 0 && (data[0].endTime || data[0].ts);
            if (!isSpotify) {
              showImportFeedback('No Spotify history found in this file.', 'rgba(239, 68, 68, 0.15)', '#ef4444');
              return;
            }
            formattedPlays = data.map(item => {
              const ts = item.endTime || item.ts || item.time || new Date().toISOString();
              const timestamp = new Date(ts).getTime();
              
              // Handle podcasts and various key formats
              const trackName = item.trackName || item.master_metadata_track_name || item.track_name || item.episode_name || item.name || 'Unknown Track';
              const artistName = item.artistName || item.master_metadata_album_artist_name || item.artist_name || item.episode_show_name || item.artist || 'Unknown Artist';
              const albumName = item.albumName || item.master_metadata_album_album_name || item.album_name || item.album || 'Unknown Album';
              const durationMs = item.msPlayed || item.ms_played || item.duration_ms || item.duration || 0;
              
              // Generate a deterministic ID so re-uploads overwrite instead of duplicate
              const cleanArtist = artistName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
              const cleanTrack = trackName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
              const id = `spotify-import-${timestamp}-${cleanArtist}-${cleanTrack}`;

              return {
                id: id,
                trackName: trackName,
                artistName: artistName,
                albumName: albumName,
                durationMs: durationMs,
                timestamp: timestamp,
                platform: 'spotify',
                genres: ['Unknown']
              };
            });
          }
          
          showImportFeedback(`Found ${formattedPlays.length} tracks. Uploading...`, 'rgba(255, 255, 255, 0.1)', '#fff');
          const res = await state.syncManualUpload(plat, formattedPlays);
          
          if (res.success) {
            showImportFeedback(`Success! Added ${res.added} new YouTube Music tracks.`, 'rgba(16, 185, 129, 0.15)', '#10b981');
          } else {
            showImportFeedback(`Failed to upload: ${res.error}`, 'rgba(239, 68, 68, 0.15)', '#ef4444');
          }
        } catch (err) {
          showImportFeedback('Error parsing JSON file.', 'rgba(239, 68, 68, 0.15)', '#ef4444');
        }
      };
      reader.readAsText(file);
    });
  });
}

// ----------------------------------------
// FILE IMPORT MECHANICS
// ----------------------------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const importFeedback = document.getElementById('import-feedback');

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleImportFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleImportFile(file);
});

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const res = state.importData(e.target.result);
    if (res.success) {
      showImportFeedback(`Successfully imported ${res.count} custom tracks!`, 'rgba(16, 185, 129, 0.15)', '#10b981');
    } else {
      showImportFeedback(`Failed to import file: ${res.error}`, 'rgba(239, 68, 68, 0.15)', '#ef4444');
    }
  };
  reader.readAsText(file);
}

function showImportFeedback(msg, bg, color) {
  importFeedback.style.display = 'block';
  importFeedback.style.backgroundColor = bg;
  importFeedback.style.color = color;
  importFeedback.innerText = msg;
  setTimeout(() => {
    importFeedback.style.display = 'none';
  }, 5000);
}

// ----------------------------------------
// RENDER VIEW: DATA EXPLORER
// ----------------------------------------
function renderExplorer() {
  const history = state.getFilteredListeningHistory();
  
  // Custom filter for search query and active filters
  const query = explorerSearchQuery.toLowerCase().trim();
  const searched = history.slice().reverse().filter(item => {
    // 1. Text Search Filter
    if (query) {
      const matchesText = item.trackName.toLowerCase().includes(query) ||
                          item.artistName.toLowerCase().includes(query) ||
                          item.albumName.toLowerCase().includes(query);
      if (!matchesText) return false;
    }
    
    // 2. Platform Filter
    if (explorerActiveFilters.platform) {
      if (explorerActiveFilters.platform === 'tidal' && item.platform === 'lastfm') {
        // Last.fm is mapped to tidal in UI, so allow it
      } else if (item.platform !== explorerActiveFilters.platform) {
        return false;
      }
    }
    
    // 3. Date Filter
    if (explorerActiveFilters.date) {
      const itemDate = item.timestamp.split('T')[0];
      if (itemDate !== explorerActiveFilters.date) {
        return false;
      }
    }
    
    return true;
  });
  
  // Render Active Filters UI
  const filtersContainer = document.getElementById('explorer-active-filters');
  if (filtersContainer) {
    let pillsHtml = '';
    if (explorerActiveFilters.platform) {
      pillsHtml += `
        <span class="platform-status connected" style="cursor:pointer; padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.clearExplorerFilter('platform')">
          Platform: ${explorerActiveFilters.platform} &times;
        </span>
      `;
    }
    if (explorerActiveFilters.date) {
      const d = new Date(explorerActiveFilters.date);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      pillsHtml += `
        <span class="platform-status connected" style="cursor:pointer; padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="window.clearExplorerFilter('date')">
          Date: ${label} &times;
        </span>
      `;
    }
    filtersContainer.innerHTML = pillsHtml;
  }

  const totalItems = searched.length;
  const totalPages = Math.max(Math.ceil(totalItems / ITEMS_PER_PAGE), 1);
  
  if (explorerPage > totalPages) {
    explorerPage = totalPages;
  }

  const startIdx = (explorerPage - 1) * ITEMS_PER_PAGE;
  const pageItems = searched.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const tbody = document.getElementById('explorer-table-body');
  
  const connected = state.getConnectedPlatforms();

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 3rem; color:var(--text-muted);">
          No streams matched search parameters.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageItems.map(item => {
      const date = new Date(item.timestamp).toLocaleString();
      let platformIcon = `<i class="ri-youtube-fill" style="color:var(--color-youtube-music);"></i>`;
      let platformName = item.platform.replace('_', ' ');
      if (item.platform === 'spotify') {
        platformIcon = `<i class="ri-spotify-fill" style="color:var(--color-spotify);"></i>`;
      } else if (item.platform === 'tidal' || item.platform === 'lastfm') {
        platformIcon = `<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="var(--color-tidal)" style="vertical-align: text-bottom; margin-right: 0.3rem;"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z"/></svg>`;
        platformName = 'Tidal';
      }

      const query = encodeURIComponent(`${item.trackName} ${item.artistName}`);
      
      let links = [];
      if (connected.spotify) links.push(`<a href="spotify:search:${query}" title="Search on Spotify" style="text-decoration:none;"><i class="ri-spotify-fill" style="color:var(--color-spotify); font-size: 1.2rem; margin-right: 0.3rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></i></a>`);
      if (connected.tidal || connected.lastfm) links.push(`<a href="https://listen.tidal.com/search?q=${query}" target="_blank" title="Search on Tidal" style="text-decoration:none; display:inline-flex; align-items:center; margin-right: 0.3rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"><svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="var(--color-tidal)"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z"/></svg></a>`);
      if (connected.youtube_music) links.push(`<a href="https://music.youtube.com/search?q=${query}" target="_blank" title="Search on YouTube Music" style="text-decoration:none;"><i class="ri-youtube-fill" style="color:var(--color-youtube-music); font-size: 1.2rem; margin-right: 0.3rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></i></a>`);

      return `
        <tr>
          <td class="platform-td">${platformIcon} ${platformName}</td>
          <td style="font-weight:600;">${escapeHTML(item.trackName)}</td>
          <td>${escapeHTML(item.artistName)}</td>
          <td style="color:var(--text-secondary);">${escapeHTML(item.albumName)}</td>
          <td><div style="display:flex; align-items:center;">${links.join('')}</div></td>
          <td>${new Date(item.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        </tr>
      `;
    }).join('');
  }

  // Update Pagination Controls
  document.getElementById('page-number-indicator').innerText = `Page ${explorerPage} of ${totalPages}`;
  document.getElementById('prev-page-btn').disabled = explorerPage === 1;
  document.getElementById('next-page-btn').disabled = explorerPage === totalPages;
}

// Explorer search and pagination events
document.getElementById('table-search-input').addEventListener('input', (e) => {
  explorerSearchQuery = e.target.value;
  explorerPage = 1;
  renderExplorer();
});

document.getElementById('prev-page-btn').addEventListener('click', () => {
  if (explorerPage > 1) {
    explorerPage--;
    renderExplorer();
  }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
  const history = state.getFilteredListeningHistory();
  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  if (explorerPage < totalPages) {
    explorerPage++;
    renderExplorer();
  }
});

// ----------------------------------------
// GLOBAL CONTROLS
// ----------------------------------------

// Wire global platform pills
document.querySelectorAll('.source-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const platform = pill.getAttribute('data-platform');
    state.togglePlatform(platform);
  });
});

function updateGlobalPills() {
  const connected = state.getConnectedPlatforms();
  document.querySelectorAll('.source-pill').forEach(pill => {
    const platform = pill.getAttribute('data-platform');
    if (connected[platform]) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

document.querySelectorAll('.time-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (btn.tagName === 'SELECT') return; // Handled by change event
    
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Reset select to "Year" when clicking other buttons
    const yearSelect = document.getElementById('year-filter-select');
    if (yearSelect) yearSelect.selectedIndex = 0;

    const filter = btn.getAttribute('data-time');
    state.setTimeFilter(filter);
  });
});

const yearFilterSelect = document.getElementById('year-filter-select');
if (yearFilterSelect) {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2009; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.style.background = 'var(--bg-surface)';
    opt.style.color = 'white';
    opt.innerText = y;
    yearFilterSelect.appendChild(opt);
  }

  yearFilterSelect.addEventListener('change', () => {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    yearFilterSelect.classList.add('active');
    
    state.setTimeFilter('year-' + yearFilterSelect.value);
  });
}

document.getElementById('reset-app-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to reset exclusions, custom imports, and linked accounts?')) {
    state.resetAllData();
    location.reload();
  }
});

// ----------------------------------------
// INITIALIZATION
// ----------------------------------------
function renderActiveView() {
  updateGlobalPills();
  
  if (activeView === 'dashboard') {
    renderDashboard();
  } else if (activeView === 'exclusions') {
    renderExclusions();
  } else if (activeView === 'connections') {
    // Check if user is actively typing in an input field to prevent focus-stealing
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'INPUT' && activeEl.closest('#view-connections')) {
      return;
    }
    renderConnections();
  } else if (activeView === 'explorer') {
    renderExplorer();
  }
}

// Subscribe to state updates to render Reactively
state.subscribe(() => {
  renderActiveView();
});

// Check if we just completed OAuth redirect
if (window.location.hash === '#connected') {
  activeView = 'connections';
  navItems.forEach(n => {
    if (n.getAttribute('data-target') === 'connections') n.classList.add('active');
    else n.classList.remove('active');
  });
  window.history.replaceState(null, null, ' '); // Clean URL hash
}

  // Theme toggle logic
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  const currentTheme = localStorage.getItem('harmony_theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    themeIcon.classList.replace('ri-moon-line', 'ri-sun-line');
  }

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('harmony_theme', 'dark');
      themeIcon.classList.replace('ri-sun-line', 'ri-moon-line');
    } else {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('harmony_theme', 'light');
      themeIcon.classList.replace('ri-moon-line', 'ri-sun-line');
    }
  });

  // Start polling backend status
  setInterval(state.initBackend, 60000);

// Load Backend Data
state.initBackend().then(() => {
  updateViewVisibility();
});

// Re-render charts on window resize for responsiveness
window.addEventListener('resize', () => {
  if (activeView === 'dashboard') {
    renderDashboard();
  }
});

const fs = require('fs');

const appJsCode = fs.readFileSync('src/js/app.js', 'utf8');

global.document = {
  getElementById: (id) => {
    if (id === 'connections-list') return {
      querySelectorAll: () => [],
      innerHTML: ''
    };
    return null;
  }
};

global.showImportFeedback = () => {};

global.state = {
  getBackendStatus: () => ({
    spotify: { connected: false, configured: false },
    tidal: { connected: false, configured: false },
    lastfm: { connected: true, configured: true }
  }),
  getConnectedPlatforms: () => ({
    spotify: false,
    tidal: false,
    youtube_music: false,
    lastfm: true
  }),
  getPlatformCounts: () => ({
    spotify: 0,
    tidal: 0,
    youtube_music: 0,
    lastfm: 50
  })
};

const renderConnectionsStr = appJsCode.substring(
  appJsCode.indexOf('function renderConnections() {'),
  appJsCode.indexOf('function bindEvents() {')
);

eval(renderConnectionsStr);

try {
  renderConnections();
  console.log("No error!");
} catch (e) {
  console.error(e);
}

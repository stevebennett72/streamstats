const fs = require('fs');
const dbPath = './db.json';
const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
let updated = 0;
data.forEach(item => {
  if (item.platform === 'lastfm' && item.durationMs === 180000) {
    item.durationMs = 0;
    updated++;
  }
});
if (updated > 0) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log(`Updated ${updated} tracks in db.json`);
} else {
  console.log('No tracks needed updating.');
}

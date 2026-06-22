// High-fidelity mock data generator for HarmonyStats
// Contains Steve's personal tracks and Kids tracks to showcase exclusions.

const KIS_ARTISTS = [
  { name: 'Cocomelon', tracks: ['Wheels on the Bus', 'Bath Song', 'Yes Yes Vegetables', 'Old MacDonald', 'Sick Song'], genres: ['Nursery Rhymes', 'Children\'s Music'], duration: 150000 },
  { name: 'Disney Cast', tracks: ['We Don\'t Talk About Bruno', 'Let It Go', 'Under the Sea', 'You\'re Welcome', 'A Whole New World', 'Surface Pressure'], genres: ['Soundtrack', 'Disney'], duration: 210000 },
  { name: 'The Wiggles', tracks: ['Fruit Salad', 'Hot Potato', 'Toot Toot, Chugga Chugga, Big Red Car', 'Do the Propeller!'], genres: ['Children\'s Music'], duration: 120000 },
  { name: 'Blippi', tracks: ['The Excavator Song', 'The Garbage Truck Song', 'Fire Truck Song'], genres: ['Children\'s Music'], duration: 180000 },
  { name: 'Pinkfong', tracks: ['Baby Shark', 'Dinosaur Search', 'Police Car'], genres: ['Nursery Rhymes', 'Children\'s Music'], duration: 130000 }
];

const STEVE_ARTISTS = {
  tidal: [
    { name: 'Miles Davis', tracks: ['So What', 'Blue in Green', 'Freddie Freeloader', 'Flamenco Sketches'], genres: ['Jazz', 'Hard Bop'], duration: 540000 },
    { name: 'John Coltrane', tracks: ['A Love Supreme, Pt. I', 'My Favorite Things', 'Giant Steps', 'In a Sentimental Mood'], genres: ['Jazz', 'Modal Jazz'], duration: 420000 },
    { name: 'Pink Floyd', tracks: ['Time', 'Money', 'Wish You Were Here', 'Comfortably Numb', 'Breathe'], genres: ['Classic Rock', 'Progressive Rock'], duration: 380000 },
    { name: 'Daft Punk', tracks: ['Get Lucky', 'One More Time', 'Harder, Better, Faster, Stronger', 'Lose Yourself to Dance'], genres: ['Electronic', 'House'], duration: 240000 },
    { name: 'Radiohead', tracks: ['Karma Police', 'Paranoid Android', 'Weird Fishes/Arpeggi', 'Everything In Its Right Place'], genres: ['Alternative Rock', 'Art Rock'], duration: 280000 }
  ],
  spotify: [
    { name: 'Tame Impala', tracks: ['The Less I Know the Better', 'Borderline', 'Let It Happen', 'Lost in Yesterday'], genres: ['Indie Rock', 'Psychedelic Pop'], duration: 260000 },
    { name: 'Daft Punk', tracks: ['Around the World', 'Instant Crush', 'Giorgio by Moroder'], genres: ['Electronic', 'House'], duration: 320000 },
    { name: 'Radiohead', tracks: ['Creep', 'No Surprises', 'High and Dry'], genres: ['Alternative Rock', 'Art Rock'], duration: 240000 },
    { name: 'The xx', tracks: ['Intro', 'Angels', 'Crystalised', 'Islands'], genres: ['Indie Pop', 'Dream Pop'], duration: 190000 }
  ],
  youtube_music: [
    { name: 'Kendrick Lamar', tracks: ['HUMBLE.', 'Alright', 'DNA.', 'Money Trees', 'King Kunta'], genres: ['Hip Hop', 'Rap'], duration: 230000 },
    { name: 'MF DOOM', tracks: ['All Caps', 'Rapp Snitch Knishes', 'Doomsday'], genres: ['Hip Hop', 'Underground Rap'], duration: 180000 },
    { name: 'Tame Impala', tracks: ['Feels Like We Only Go Backwards', 'Elephant'], genres: ['Indie Rock', 'Psychedelic Pop'], duration: 220000 },
    { name: 'Gorillaz', tracks: ['Feel Good Inc.', 'Clint Eastwood', 'On Melancholy Hill', 'Dare'], genres: ['Alternative Rock', 'Trip Hop'], duration: 210000 }
  ]
};

// Generate realistic data spanning the last 60 days
export function generateMockHistory() {
  const history = [];
  const now = new Date();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  // Seed random generator for consistent mock data
  let seed = 42;
  function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function getRandomElement(arr) {
    return arr[Math.floor(random() * arr.length)];
  }

  // Generate around 1200 listening sessions over 60 days
  for (let i = 0; i < 1200; i++) {
    // Determine date offset
    const daysAgo = random() * 60; // Up to 60 days ago
    const hour = Math.floor(random() * 24);
    const minute = Math.floor(random() * 60);
    const timestamp = new Date(now.getTime() - (daysAgo * ONE_DAY));
    timestamp.setHours(hour, minute, 0, 0);

    // Determine platform
    let platform = 'spotify';
    const rPlatform = random();
    if (rPlatform < 0.35) {
      platform = 'tidal';
    } else if (rPlatform < 0.6) {
      platform = 'youtube_music';
    }

    let item;
    
    // Spotify has a high chance of kids music (simulate kids listening in the morning/afternoon)
    if (platform === 'spotify' && (hour >= 7 && hour <= 17) && random() < 0.65) {
      // Kid track
      const artist = getRandomElement(KIS_ARTISTS);
      const track = getRandomElement(artist.tracks);
      item = {
        id: `play-${i}`,
        trackName: track,
        artistName: artist.name,
        albumName: `${artist.name} Hits`,
        durationMs: artist.duration,
        timestamp: timestamp.toISOString(),
        platform,
        genres: artist.genres,
        isKidsMusic: true
      };
    } else {
      // Steve track
      const artists = STEVE_ARTISTS[platform];
      const artist = getRandomElement(artists);
      const track = getRandomElement(artist.tracks);
      item = {
        id: `play-${i}`,
        trackName: track,
        artistName: artist.name,
        albumName: `${artist.name} Essentials`,
        durationMs: artist.duration,
        timestamp: timestamp.toISOString(),
        platform,
        genres: artist.genres,
        isKidsMusic: false
      };
    }
    
    history.push(item);
  }

  // Sort chronologically (oldest first)
  return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Recommended artists to exclude (auto-detected kids content)
export const AUTO_EXCLUDE_SUGGESTIONS = [
  'Cocomelon',
  'Disney Cast',
  'The Wiggles',
  'Blippi',
  'Pinkfong'
];

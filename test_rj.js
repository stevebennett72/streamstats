import axios from 'axios';

axios.get(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=rj&api_key=5a9f4c9716426d5da11630fa135f5ac6&format=json&limit=5`)
  .then(res => console.log(JSON.stringify(res.data.recenttracks.track, null, 2)))
  .catch(err => console.log(err.message));

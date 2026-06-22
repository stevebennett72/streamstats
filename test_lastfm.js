import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.LASTFM_CLIENT_ID;
const username = process.env.LASTFM_CLIENT_SECRET;

console.log("Key:", apiKey, "User:", username);

axios.get(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=200`)
  .then(res => console.log("SUCCESS:", res.data.recenttracks.track.length, "tracks"))
  .catch(err => console.log("ERROR:", err.response ? err.response.data : err.message));

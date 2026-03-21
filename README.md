# Spotify Web API TypeScript Client

A TypeScript client for interacting with Spotify's Web API with comprehensive listening analysis features. Get insights into your music preferences by analyzing your playlists, saved tracks, and top items.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

## Getting an Access Token

To use this client, you need a Spotify access token with the following scopes:
- `user-top-read` - For top artists and tracks
- `playlist-read-private` - For reading your playlists
- `user-library-read` - For reading your saved tracks

Here are a few ways to get one:

### Option 1: Using Spotify's Web API Console

1. Go to [Spotify's Web API Console](https://developer.spotify.com/console/get-users-top-artists-and-tracks/)
2. Click "Get Token"
3. Select the required scopes: `user-top-read`, `playlist-read-private`, `user-library-read`
4. Authorize and copy the access token
5. Save it to a `.env` file: `SPOTIFY_ACCESS_TOKEN=your_token_here`

### Option 2: Using OAuth 2.0 Authorization Code Flow (Recommended)

This project includes a built-in OAuth server for a more secure and permanent solution:

1. **Create a Spotify App:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Click "Create app"
   - Fill in app name and description
   - Accept the terms
   - Note your **Client ID** and **Client Secret**

2. **Set up your `.env` file:**
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

3. **Add Redirect URI:**
   - In your Spotify app settings, add this Redirect URI: `http://localhost:8888/callback`
   - Save the changes

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Start the OAuth server:**
   ```bash
   npm run auth
   ```

6. **Authorize:**
   - Open http://localhost:8888 in your browser
   - Click "Authorize Spotify"
   - Log in and grant permissions
   - Your access token will be automatically saved to `.env`

7. **Refresh Token (when needed):**
   - **Via web browser:** Visit http://localhost:8888/refresh
   - **Via command line:** Run `npm run refresh-token` (requires refresh token in .env)

The OAuth server automatically handles:
- State verification (CSRF protection)
- Token exchange
- Saving tokens to `.env`
- Refresh token management

### Option 3: Quick Test Token

You can also use the [Spotify Web API Console](https://developer.spotify.com/console/) to generate a token for quick testing, though this requires manual copying.

## Usage

### Running the Test Scripts

```bash
# Test basic API endpoints
npm test

# Test listening analysis (analyzes all playlists)
npm run test:analysis
```

Make sure to set `SPOTIFY_ACCESS_TOKEN` in your `.env` file or as an environment variable.

### Using in Your Code

```typescript
import { SpotifyClient } from './src/spotify-client';

const client = new SpotifyClient('your_access_token');

// Get top artists
const topArtists = await client.getTopArtists('medium_term', 20);
console.log(topArtists.items);

// Get top tracks
const topTracks = await client.getTopTracks('short_term', 10);
console.log(topTracks.items);

// Generic method
const topItems = await client.getTopItems({
  type: 'artists',
  time_range: 'long_term',
  limit: 50,
  offset: 0
});

// Get all your playlists
const playlists = await client.getAllPlaylists();

// Get tracks from a specific playlist
const tracks = await client.getPlaylistTracks('playlist_id_here');

// Get all saved tracks
const savedTracks = await client.getSavedTracks();

// Analyze artist frequency across all playlists and saved tracks
const artistFreq = await client.analyzeArtistFrequency({
  includePlaylists: true,
  includeSavedTracks: true,
  includeTopTracks: true,
});

// Analyze genre frequency
const genreFreq = await client.analyzeGenreFrequency({
  includePlaylists: true,
  includeSavedTracks: true,
  includeTopArtists: true,
});

// Analyze track frequency
const trackFreq = await client.analyzeTrackFrequency({
  includePlaylists: true,
  includeSavedTracks: true,
});

// Get comprehensive listening analysis
const analysis = await client.analyzeListeningData({
  includePlaylists: true,
  includeSavedTracks: true,
  includeTopTracks: true,
  includeTopArtists: true,
});
console.log(`Top artist: ${analysis.artistFrequencies[0].artistName}`);
console.log(`Top genre: ${analysis.genreFrequencies[0].genre}`);
```

## API Reference

### `SpotifyClient`

#### Constructor
```typescript
new SpotifyClient(accessToken: string)
```

#### Methods

##### `getTopItems(params: GetTopItemsParams): Promise<PagingObject<TopItem>>`
Get the current user's top artists or tracks.

**Parameters:**
- `params.type`: `'artists'` or `'tracks'` (required)
- `params.time_range`: `'long_term'` | `'medium_term'` | `'short_term'` (optional, default: `'medium_term'`)
- `params.limit`: number between 1-50 (optional, default: 20)
- `params.offset`: number (optional, default: 0)

##### `getTopArtists(time_range?, limit?, offset?): Promise<PagingObject<Artist>>`
Convenience method to get top artists.

##### `getTopTracks(time_range?, limit?, offset?): Promise<PagingObject<Track>>`
Convenience method to get top tracks.

##### `getAllPlaylists(limit?): Promise<SimplifiedPlaylist[]>`
Get all of the current user's playlists. Automatically handles pagination.

##### `getPlaylistTracks(playlistId, limit?, market?): Promise<Track[]>`
Get all tracks from a specific playlist. Automatically handles pagination.

##### `getSavedTracks(limit?, market?): Promise<Track[]>`
Get all saved tracks of the current user. Automatically handles pagination.

##### `analyzeArtistFrequency(options?): Promise<ArtistFrequency[]>`
Analyze how often artists appear across playlists, saved tracks, and top tracks.

**Options:**
- `includePlaylists`: boolean (default: true)
- `includeSavedTracks`: boolean (default: true)
- `includeTopTracks`: boolean (default: true)
- `topTracksLimit`: number (default: 50)

**Returns:** Array of artists sorted by frequency, with count, percentage, and source breakdown.

##### `analyzeGenreFrequency(options?): Promise<GenreFrequency[]>`
Analyze genre distribution across your listening data.

**Options:**
- `includePlaylists`: boolean (default: true)
- `includeSavedTracks`: boolean (default: true)
- `includeTopArtists`: boolean (default: true)
- `topArtistsLimit`: number (default: 50)

**Returns:** Array of genres sorted by frequency, with associated artists.

##### `analyzeTrackFrequency(options?): Promise<TrackFrequency[]>`
Find which tracks appear most frequently across playlists and saved tracks.

**Options:**
- `includePlaylists`: boolean (default: true)
- `includeSavedTracks`: boolean (default: true)

**Returns:** Array of tracks sorted by frequency of appearance.

##### `analyzeListeningData(options?): Promise<ListeningAnalysis>`
Comprehensive analysis combining all data sources.

**Options:**
- `includePlaylists`: boolean (default: true)
- `includeSavedTracks`: boolean (default: true)
- `includeTopTracks`: boolean (default: true)
- `includeTopArtists`: boolean (default: true)
- `topItemsLimit`: number (default: 50)

**Returns:** Complete analysis object with artist, genre, and track frequencies plus summary statistics.

## Listening Analysis Features

The client provides comprehensive listening analysis by aggregating data from multiple sources:

### Data Sources
- **Playlists**: All tracks from all your playlists
- **Saved Tracks**: Your liked/saved tracks library
- **Top Tracks**: Your most played tracks (calculated by Spotify)
- **Top Artists**: Your most listened artists (used for genre analysis)

### Analysis Types

1. **Artist Frequency**: Count how many times each artist appears across all sources
2. **Genre Frequency**: Analyze genre distribution (genres come from artist metadata)
3. **Track Frequency**: Find tracks that appear in multiple playlists or are saved
4. **Comprehensive Analysis**: Get all metrics in one call

### Example Output

```typescript
const analysis = await client.analyzeListeningData();

// Top artist
console.log(analysis.artistFrequencies[0]);
// {
//   artistId: "abc123",
//   artistName: "Your Favorite Artist",
//   count: 45,
//   percentage: 12.5,
//   sources: { playlists: 30, savedTracks: 10, topTracks: 5 }
// }

// Top genre
console.log(analysis.genreFrequencies[0]);
// {
//   genre: "indie rock",
//   count: 120,
//   percentage: 25.0,
//   artists: ["Artist 1", "Artist 2", ...]
// }
```

## Time Ranges

- `long_term`: Calculated from ~1 year of data
- `medium_term`: Approximately last 6 months (default)
- `short_term`: Approximately last 4 weeks

## Error Handling

The client throws errors with descriptive messages if API calls fail:

```typescript
try {
  const topArtists = await client.getTopArtists();
} catch (error) {
  console.error('Error:', error.message);
}
```

## Performance Notes

- Analysis methods automatically handle pagination to fetch all data
- Large playlists may take some time to process
- The client processes playlists in batches to avoid rate limits
- Consider using the `topItemsLimit` option to limit top tracks/artists analyzed

## References

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Get User's Top Items Endpoint](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)
- [Get Playlist Items Endpoint](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks)
- [Get User's Saved Tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks)


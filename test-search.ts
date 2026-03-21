import { SpotifyClient, SearchResult } from './src/spotify-client';
import dotenv from 'dotenv';

/**
 * Test script for searching across your own playlists
 * 
 * Usage:
 * 1. Set SPOTIFY_ACCESS_TOKEN in .env file
 * 2. Run: npm run test:search
 */

dotenv.config();
const ACCESS_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN!;

async function testSearch() {
  if (!ACCESS_TOKEN) {
    console.error('❌ Error: Access token is required!');
    console.error('\nPlease set SPOTIFY_ACCESS_TOKEN in your .env file.');
    process.exit(1);
  }

  const client = new SpotifyClient(ACCESS_TOKEN);

  console.log('🔍 Testing Spotify Playlist Search\n');

  try {
    // Get current user info
    console.log('👤 Getting your profile...');
    const profile = await client.getCurrentUserProfile();
    console.log(`✅ Logged in as: ${profile.display_name || profile.id}\n`);

    // Get your playlists
    console.log('📋 Getting your playlists...');
    const myPlaylists = await client.getMyPlaylists();
    console.log(`✅ Found ${myPlaylists.length} playlists owned by you\n`);

    // Show playlist names
    console.log('📝 Your Playlists:');
    myPlaylists.forEach((playlist, index) => {
      console.log(`  ${index + 1}. ${playlist.name} (${playlist.tracks.total} tracks)`);
    });
    console.log('');

    // Search example - replace with your search query
    const searchQuery = process.argv[2] || 'Nujabes'; // Default search or use command line argument
    
    console.log(`🔍 Searching for: "${searchQuery}"\n`);
    const results = await client.searchMyPlaylists(searchQuery);

    if (results.length === 0) {
      console.log(`❌ No matches found for "${searchQuery}"`);
    } else {
      console.log(`✅ Found ${results.length} match(es):\n`);
      
      // Group results by playlist
      const byPlaylist = new Map<string, SearchResult[]>();
      for (const result of results) {
        if (!byPlaylist.has(result.playlistName)) {
          byPlaylist.set(result.playlistName, []);
        }
        byPlaylist.get(result.playlistName)!.push(result);
      }

      // Display results grouped by playlist
      for (const [playlistName, tracks] of byPlaylist.entries()) {
        console.log(`📀 Playlist: ${playlistName}`);
        tracks.forEach((result, index) => {
          const artists = result.track.artists.map(a => a.name).join(', ');
          console.log(`   ${index + 1}. ${result.track.name} by ${artists}`);
          console.log(`      Spotify: ${result.track.external_urls.spotify}`);
        });
        console.log('');
      }
    }

    console.log('✅ Search completed!\n');

  } catch (error) {
    console.error('❌ Error occurred:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('401')) {
      console.error('\n💡 Tip: Your access token may have expired.');
      console.error('   Run: npm run auth');
      console.error('   Or visit: http://localhost:8888');
    }
    
    process.exit(1);
  }
}

// Run the search tests
testSearch();


import { SpotifyClient } from './src/spotify-client';
import dotenv from 'dotenv';

/**
 * Test script for Spotify API listening analysis
 * 
 * Usage:
 * 1. Set SPOTIFY_ACCESS_TOKEN in .env file
 * 2. Run: npm run test:analysis
 */

dotenv.config();
const ACCESS_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN!;

async function testAnalysis() {
  if (!ACCESS_TOKEN) {
    console.error('❌ Error: Access token is required!');
    console.error('\nPlease set SPOTIFY_ACCESS_TOKEN in your .env file.');
    process.exit(1);
  }

  const client = new SpotifyClient(ACCESS_TOKEN);

  console.log('📊 Testing Spotify Listening Analysis\n');
  console.log('⏳ This may take a while as we analyze all your playlists...\n');

  try {
    // Test 1: Artist Frequency Analysis (largest playlist only)
    console.log('🎤 Test 1: Analyzing Artist Frequency (largest playlist only)...\n');
    const artistFreq = await client.analyzeArtistFrequency({
      includePlaylists: true,
      includeSavedTracks: false, // Skip saved tracks to avoid rate limits
      includeTopTracks: false, // Skip top tracks to avoid rate limits
      largestPlaylistCount: 1, // Analyze only the largest playlist
    });

    console.log(`✅ Found ${artistFreq.length} unique artists\n`);
    console.log('📈 Top 10 Artists by Frequency:\n');
    artistFreq.slice(0, 10).forEach((artist, index) => {
      console.log(`  ${index + 1}. ${artist.artistName}`);
      console.log(`     Appearances: ${artist.count} (${artist.percentage.toFixed(2)}%)`);
      console.log(`     Sources: ${artist.sources.playlists} playlists, ${artist.sources.savedTracks} saved, ${artist.sources.topTracks} top tracks\n`);
    });

    // Test 2: Genre Frequency Analysis (largest playlist only)
    console.log('\n🎵 Test 2: Analyzing Genre Frequency (largest playlist only)...\n');
    const genreFreq = await client.analyzeGenreFrequency({
      includePlaylists: true,
      includeSavedTracks: false,
      includeTopArtists: false,
      largestPlaylistCount: 1,
    });

    console.log(`✅ Found ${genreFreq.length} unique genres\n`);
    console.log('📊 Top 10 Genres by Frequency:\n');
    genreFreq.slice(0, 10).forEach((genre, index) => {
      console.log(`  ${index + 1}. ${genre.genre}`);
      console.log(`     Frequency: ${genre.count} (${genre.percentage.toFixed(2)}%)`);
      console.log(`     Sample Artists: ${genre.artists.slice(0, 3).join(', ')}\n`);
    });

    // Test 3: Track Frequency Analysis (largest playlist only)
    console.log('\n🎧 Test 3: Analyzing Track Frequency (largest playlist only)...\n');
    const trackFreq = await client.analyzeTrackFrequency({
      includePlaylists: true,
      includeSavedTracks: false,
      largestPlaylistCount: 1,
    });

    console.log(`✅ Found ${trackFreq.length} unique tracks\n`);
    console.log('🔝 Top 10 Most Repeated Tracks:\n');
    trackFreq.slice(0, 10).forEach((track, index) => {
      console.log(`  ${index + 1}. ${track.trackName} by ${track.artistNames.join(', ')}`);
      console.log(`     Appearances: ${track.count} (${track.percentage.toFixed(2)}%)\n`);
    });

    // Test 4: Comprehensive Analysis (largest playlist only)
    console.log('\n📋 Test 4: Comprehensive Listening Analysis (largest playlist only)...\n');
    const analysis = await client.analyzeListeningData({
      includePlaylists: true,
      includeSavedTracks: false,
      includeTopTracks: false,
      includeTopArtists: false,
      largestPlaylistCount: 1,
    });

    console.log('📊 Summary Statistics:\n');
    console.log(`  Total Track Occurrences: ${analysis.totalTracks}`);
    console.log(`  Unique Artists: ${analysis.totalArtists}`);
    console.log(`  Unique Genres: ${analysis.totalGenres}`);
    console.log(`  Sources Analyzed:`);
    console.log(`    - Playlists: ${analysis.sources.playlists}`);
    console.log(`    - Saved Tracks: ${analysis.sources.savedTracks}`);
    console.log(`    - Top Tracks: ${analysis.sources.topTracks}\n`);

    console.log('✅ All analysis tests completed!\n');

  } catch (error) {
    console.error('❌ Error occurred:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('Insufficient client scope')) {
      // Error message already includes helpful instructions
      console.error('\n💡 The error message above includes instructions on how to get the correct scopes.');
    } else if (error instanceof Error && (error.message.includes('401') || error.message.includes('expired'))) {
      console.error('\n💡 Tip: Your access token may have expired. Get a new one from:');
      console.error('   https://developer.spotify.com/console/get-users-top-artists-and-tracks/');
      console.error('   Make sure to include these scopes:');
      console.error('     ✓ user-top-read');
      console.error('     ✓ playlist-read-private');
      console.error('     ✓ user-library-read');
    }
    
    process.exit(1);
  }
}

// Run the analysis tests
testAnalysis();


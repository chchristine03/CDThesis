import { SpotifyClient } from './src/spotify-client';
import dotenv from 'dotenv';
/**
 * Test script for Spotify API client
 * 
 * Usage:
 * 1. Get your access token from Spotify (see README.md)
 * 2. Set it as an environment variable: export SPOTIFY_ACCESS_TOKEN="your_token_here"
 * 3. Run: npm test
 * 
 * Or pass token directly: ACCESS_TOKEN=your_token npm test
 */

dotenv.config();
const ACCESS_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN!;

async function testSpotifyAPI() {
  // Get access token from environment variable or command line argument
  if (!ACCESS_TOKEN) {
    console.error('❌ Error: Access token is required!');
    console.error('\nPlease provide your Spotify access token in one of these ways:');
    console.error('  1. Set SPOTIFY_ACCESS_TOKEN environment variable');
    console.error('  2. Set ACCESS_TOKEN environment variable');
    console.error('  3. Pass it as a command line argument: npm test your_token_here');
    console.error('\nSee README.md for instructions on how to get an access token.');
    process.exit(1);
  }

  const client = new SpotifyClient(ACCESS_TOKEN);

  console.log('🎵 Testing Spotify Web API - Get User\'s Top Items\n');

  try {
    // Test 1: Get top artists (medium_term - default)
    console.log('📊 Test 1: Getting top artists (medium_term)...');
    const topArtists = await client.getTopArtists('medium_term', 5);
    console.log(`✅ Found ${topArtists.total} total artists`);
    console.log(`📋 Showing top ${topArtists.items.length} artists:\n`);
    topArtists.items.forEach((artist, index) => {
      console.log(`  ${index + 1}. ${artist.name}`);
      console.log(`     Popularity: ${artist.popularity}`);
      console.log(`     Genres: ${artist.genres.slice(0, 3).join(', ') || 'N/A'}`);
      console.log(`     Spotify: ${artist.external_urls.spotify}\n`);
    });

    // Test 2: Get top tracks (short_term)
    console.log('🎵 Test 2: Getting top tracks (short_term)...');
    const topTracks = await client.getTopTracks('short_term', 5);
    console.log(`✅ Found ${topTracks.total} total tracks`);
    console.log(`📋 Showing top ${topTracks.items.length} tracks:\n`);
    topTracks.items.forEach((track, index) => {
      const duration = Math.floor(track.duration_ms / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      console.log(`  ${index + 1}. ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
      console.log(`     Album: ${track.album.name}`);
      console.log(`     Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      console.log(`     Popularity: ${track.popularity}`);
      console.log(`     Spotify: ${track.external_urls.spotify}\n`);
    });

    // Test 3: Get top artists (long_term) with offset
    console.log('📊 Test 3: Getting top artists 1-5 (long_term with offset)...');
    const topArtistsLongTerm = await client.getTopArtists('long_term', 5, 0);
    console.log(`✅ Found ${topArtistsLongTerm.total} total artists`);
    console.log(`📋 Showing artists 1-5:\n`);
    topArtistsLongTerm.items.forEach((artist, index) => {
      console.log(`  ${index + 1}. ${artist.name}`);
      console.log(`     Popularity: ${artist.popularity}\n`);
    });

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error occurred:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('Insufficient client scope')) {
      console.error('\n💡 Tip: Your access token needs additional scopes.');
      console.error('   Visit: https://developer.spotify.com/console/get-users-top-artists-and-tracks/');
      console.error('   Click "Get Token" and select:');
      console.error('     ✓ user-top-read');
      console.error('     ✓ playlist-read-private (for analysis features)');
      console.error('     ✓ user-library-read (for analysis features)');
    }
    
    process.exit(1);
  }
}

// Run the tests
testSpotifyAPI();


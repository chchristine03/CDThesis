import { NextRequest, NextResponse } from 'next/server';
import { SpotifyClient } from '../../../src/spotify-client';
import {
  buildHouseSpecFromSpotify,
  getDemoHouse,
  getPresetFromQuery,
} from '../../../lib/house';
import {
  getSpotifyAccessTokenForRequest,
  setSpotifyAuthCookies,
} from '../../../lib/spotify-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isDemo = searchParams.get('demo') === '1';
  if (isDemo) {
    const preset = getPresetFromQuery(searchParams.get('preset'));
    return NextResponse.json(getDemoHouse(preset));
  }

  const auth = await getSpotifyAccessTokenForRequest(request);
  if (!auth.accessToken) {
    return NextResponse.json(
      { error: 'Missing Spotify access token. Please login via /api/auth/login.' },
      { status: 401 }
    );
  }

  try {
    const client = new SpotifyClient(auth.accessToken);
    const timeRange = 'short_term' as const;
    const [profile, artists, tracks] = await Promise.all([
      client.getCurrentUserProfile(),
      client.getTopArtists(timeRange, 20, 0),
      client.getTopTracks(timeRange, 20, 0),
    ]);

    const response = NextResponse.json(
      buildHouseSpecFromSpotify({ profile, artists, tracks, timeRange })
    );
    if (auth.refreshed) {
      setSpotifyAuthCookies(
        response,
        auth.refreshedTokens,
        auth.existingRefreshToken
      );
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

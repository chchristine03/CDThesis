import { NextRequest, NextResponse } from 'next/server';
import { SpotifyClient } from '../../../../src/spotify-client';
import {
  buildHouseSpecFromSpotify,
  getDemoHouse,
  getPresetFromQuery,
} from '../../../../lib/house';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const expectedKey = process.env.TD_SHARED_KEY;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isDemo = searchParams.get('demo') === '1';
  if (isDemo) {
    const preset = getPresetFromQuery(searchParams.get('preset'));
    return NextResponse.json(getDemoHouse(preset));
  }

  const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Missing Spotify access token.' },
      { status: 401 }
    );
  }

  try {
    const client = new SpotifyClient(accessToken);
    const timeRange = 'short_term' as const;
    const [profile, artists, tracks] = await Promise.all([
      client.getCurrentUserProfile(),
      client.getTopArtists(timeRange, 20, 0),
      client.getTopTracks(timeRange, 20, 0),
    ]);

    return NextResponse.json(
      buildHouseSpecFromSpotify({ profile, artists, tracks, timeRange })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

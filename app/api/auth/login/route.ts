import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  SPOTIFY_REDIRECT_COOKIE,
  SPOTIFY_SCOPES,
  SPOTIFY_STATE_COOKIE,
  getSpotifyRedirectUri,
} from '../../../../lib/spotify-auth';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectParam = new URL(request.url).searchParams.get('redirect');
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Missing SPOTIFY_CLIENT_ID in environment variables.' },
      { status: 500 }
    );
  }

  let target: string;
  if (redirectParam) {
    target = redirectParam.startsWith('http')
      ? redirectParam
      : `${origin}${redirectParam}`;
  } else {
    //make sure it doesnt set origin to localhost
    target = `${origin}/adventure`;
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = getSpotifyRedirectUri(origin);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    show_dialog: 'true',
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(SPOTIFY_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  if (target.includes('localhost')) {
    target = target.replace('localhost', '127.0.0.1');
  }
  response.cookies.set(SPOTIFY_REDIRECT_COOKIE, target, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  return response;
}

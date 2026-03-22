import { NextRequest, NextResponse } from 'next/server';
import {
  SPOTIFY_REDIRECT_COOKIE,
  SPOTIFY_STATE_COOKIE,
  clearSpotifyOAuthFlowCookies,
  exchangeAuthorizationCode,
  getSpotifyRedirectUri,
  setSpotifyAuthCookies,
} from '../../../../lib/spotify-auth';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const search = request.nextUrl.searchParams;
  const code = search.get('code');
  const state = search.get('state');
  const oauthError = search.get('error');

  const storedState = request.cookies.get(SPOTIFY_STATE_COOKIE)?.value;
  const redirectTarget =
    request.cookies.get(SPOTIFY_REDIRECT_COOKIE)?.value || `${origin}/adventure`;

  if (oauthError) {
    const response = NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(oauthError)}`
    );
    clearSpotifyOAuthFlowCookies(response);
    return response;
  }

  if (!code || !state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(`${origin}/?auth_error=invalid_state`);
    clearSpotifyOAuthFlowCookies(response);
    return response;
  }

  try {
    const redirectUri = getSpotifyRedirectUri(origin);
    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    const response = NextResponse.redirect(redirectTarget);
    setSpotifyAuthCookies(response, tokens);
    clearSpotifyOAuthFlowCookies(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'token_exchange_failed';
    const response = NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(message)}`
    );
    clearSpotifyOAuthFlowCookies(response);
    return response;
  }
}

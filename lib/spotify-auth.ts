import { NextRequest, NextResponse } from 'next/server';

export const SPOTIFY_SCOPES =
  'user-top-read playlist-read-private user-library-read user-read-recently-played';

export const SPOTIFY_ACCESS_COOKIE = 'spotify_access_token';
export const SPOTIFY_REFRESH_COOKIE = 'spotify_refresh_token';
export const SPOTIFY_EXPIRES_COOKIE = 'spotify_expires_at';
export const SPOTIFY_STATE_COOKIE = 'spotify_oauth_state';
export const SPOTIFY_REDIRECT_COOKIE = 'spotify_post_auth_redirect';

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export function getSpotifyRedirectUri(origin: string): string {
  return process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/auth/callback`;
}

function ensureSpotifyClientConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

async function requestSpotifyToken(
  params: URLSearchParams
): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = ensureSpotifyClientConfig();
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`,
    },
    body: params.toString(),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error_description === 'string'
        ? data.error_description
        : typeof data?.error === 'string'
          ? data.error
          : `Spotify token request failed (${response.status}).`;
    throw new Error(message);
  }

  return data as SpotifyTokenResponse;
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<SpotifyTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  return requestSpotifyToken(params);
}

export async function refreshSpotifyAccessToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return requestSpotifyToken(params);
}

export function setSpotifyAuthCookies(
  response: NextResponse,
  tokens: SpotifyTokenResponse,
  existingRefreshToken?: string
) {
  const secure = process.env.NODE_ENV === 'production';
  const expiresAtMs = Date.now() + Math.max(tokens.expires_in, 0) * 1000;

  response.cookies.set(SPOTIFY_ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(tokens.expires_in, 60),
  });

  const refreshToken = tokens.refresh_token || existingRefreshToken;
  if (refreshToken) {
    response.cookies.set(SPOTIFY_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  response.cookies.set(SPOTIFY_EXPIRES_COOKIE, String(expiresAtMs), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSpotifyAuthCookies(response: NextResponse) {
  response.cookies.delete(SPOTIFY_ACCESS_COOKIE);
  response.cookies.delete(SPOTIFY_REFRESH_COOKIE);
  response.cookies.delete(SPOTIFY_EXPIRES_COOKIE);
}

export function clearSpotifyOAuthFlowCookies(response: NextResponse) {
  response.cookies.delete(SPOTIFY_STATE_COOKIE);
  response.cookies.delete(SPOTIFY_REDIRECT_COOKIE);
}

export async function getSpotifyAccessTokenForRequest(
  request: NextRequest
): Promise<
  | { accessToken: string; refreshed: false }
  | {
      accessToken: string;
      refreshed: true;
      refreshedTokens: SpotifyTokenResponse;
      existingRefreshToken?: string;
    }
  | { accessToken: null; refreshed: false }
> {
  const accessToken = request.cookies.get(SPOTIFY_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(SPOTIFY_REFRESH_COOKIE)?.value;
  const expiresAtRaw = request.cookies.get(SPOTIFY_EXPIRES_COOKIE)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN;

  const hasValidExpiry =
    Number.isFinite(expiresAt) && expiresAt - Date.now() > 60 * 1000;

  if (accessToken && hasValidExpiry) {
    return { accessToken, refreshed: false };
  }

  if (!refreshToken) {
    return { accessToken: null, refreshed: false };
  }

  const refreshedTokens = await refreshSpotifyAccessToken(refreshToken);
  return {
    accessToken: refreshedTokens.access_token,
    refreshed: true,
    refreshedTokens,
    existingRefreshToken: refreshToken,
  };
}

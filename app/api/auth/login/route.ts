import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.SPOTIFY_AUTH_BASE_URL || 'http://localhost:8888';
  const origin = request.nextUrl.origin;
  const redirectParam = new URL(request.url).searchParams.get('redirect');

  let target: string;
  if (redirectParam) {
    target = redirectParam.startsWith('http')
      ? redirectParam
      : `${origin}${redirectParam}`;
  } else {
    target = `${origin}/story`;
  }

  const params = new URLSearchParams({ redirect: target });
  return NextResponse.redirect(`${baseUrl}/login?${params.toString()}`);
}

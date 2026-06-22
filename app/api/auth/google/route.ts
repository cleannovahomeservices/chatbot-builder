import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');
  const rawNext = searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') ? rawNext : '';
  const appUrl = new URL(request.url).origin;

  const state = crypto.randomBytes(16).toString('hex');
  const callbackBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || appUrl;
  const redirectUri = `${callbackBase}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
    state,
  });

  const redirectTarget = next
    ? `${appUrl}${next}`
    : mode && input
    ? `${appUrl}/create?mode=${mode}&input=${encodeURIComponent(input)}`
    : `${appUrl}/dashboard`;

  const cookieDomain = process.env.NODE_ENV === 'production' ? '.botluma.com' : undefined;
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 600,
    path: '/',
    domain: cookieDomain,
  };

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  response.cookies.set('google_oauth_state', state, cookieOpts);
  response.cookies.set('post_auth_redirect', redirectTarget, cookieOpts);

  return response;
}

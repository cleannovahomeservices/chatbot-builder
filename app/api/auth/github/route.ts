import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/github';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');

  const state = crypto.randomBytes(16).toString('hex');
  const oauthUrl = getOAuthUrl(state);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const response = NextResponse.redirect(oauthUrl);

  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  if (mode && input) {
    response.cookies.set('create_params', JSON.stringify({ mode, input }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  }

  response.cookies.set('post_auth_redirect', `${appUrl}/create`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}

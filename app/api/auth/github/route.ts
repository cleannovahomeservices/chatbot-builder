import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/github';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // If already logged in, skip OAuth and go straight to destination
  const existingUser = await getSession();
  if (existingUser) {
    const response = NextResponse.redirect(
      mode && input ? `${appUrl}/create` : `${appUrl}/dashboard`
    );
    if (mode && input) {
      response.cookies.set('create_params', JSON.stringify({ mode, input }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });
    }
    return response;
  }

  const state = crypto.randomBytes(16).toString('hex');
  const oauthUrl = getOAuthUrl(state);
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

  const redirectTarget = mode && input ? `${appUrl}/create` : `${appUrl}/dashboard`;
  response.cookies.set('post_auth_redirect', redirectTarget, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}

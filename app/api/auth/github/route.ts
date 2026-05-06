import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/github';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');
  const link = searchParams.get('link') === 'true';
  const appUrl = new URL(request.url).origin;

  // If already logged in and NOT linking, skip OAuth
  if (!link) {
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
  }

  const state = crypto.randomBytes(16).toString('hex');
  const oauthUrl = getOAuthUrl(state, appUrl);
  const response = NextResponse.redirect(oauthUrl);

  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  if (link) {
    response.cookies.set('github_linking', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  }

  if (mode && input) {
    response.cookies.set('create_params', JSON.stringify({ mode, input }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  }

  const redirectTarget = link
    ? `${appUrl}/create`
    : mode && input
    ? `${appUrl}/create`
    : `${appUrl}/dashboard`;

  response.cookies.set('post_auth_redirect', redirectTarget, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}

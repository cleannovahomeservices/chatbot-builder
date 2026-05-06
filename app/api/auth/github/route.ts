import { NextRequest, NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/github';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');
  const rawNext = searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') ? rawNext : '';
  const force = searchParams.get('force') === 'true';
  const appUrl = new URL(request.url).origin;

  const existingUser = await getSession();
  if (existingUser && !force) {
    if (existingUser.github_access_token) {
      // Already has GitHub — skip OAuth and go directly to destination
      const dest = next
        ? `${appUrl}${next}`
        : mode && input
        ? `${appUrl}/create`
        : `${appUrl}/dashboard`;
      const response = NextResponse.redirect(dest);
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
    // Has session but no GitHub token — proceed with OAuth to link
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

  if (mode && input) {
    response.cookies.set('create_params', JSON.stringify({ mode, input }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  }

  const redirectTarget = next
    ? `${appUrl}${next}`
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

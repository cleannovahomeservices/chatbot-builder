import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getGitHubUser } from '@/lib/github';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('github_oauth_state')?.value;
  const appUrl = new URL(request.url).origin;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGitHubUser(accessToken);

    const db = createAdminClient();

    const { data: user, error } = await db
      .from('users')
      .upsert(
        {
          github_id: githubUser.id,
          github_username: githubUser.login,
          github_email: githubUser.email,
          github_avatar_url: githubUser.avatar_url,
          github_access_token: accessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_id' }
      )
      .select()
      .single();

    if (error || !user) throw new Error('Failed to upsert user');

    const sessionToken = await createSession(user);
    const redirectTo =
      request.cookies.get('post_auth_redirect')?.value || `${appUrl}/create`;

    const response = NextResponse.redirect(redirectTo);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    });
    response.cookies.delete('github_oauth_state');
    response.cookies.delete('post_auth_redirect');

    return response;
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}

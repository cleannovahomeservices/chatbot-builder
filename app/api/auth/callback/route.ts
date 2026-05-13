import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getGitHubUser } from '@/lib/github';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession, createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

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

    // If user already has a valid session without a GitHub token, link GitHub to that account
    const existingSessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (existingSessionToken) {
      const existingUser = await getSession(existingSessionToken);
      if (existingUser && !existingUser.github_access_token) {
        const { error: updateError } = await db
          .from('users')
          .update({
            github_id: githubUser.id,
            github_username: githubUser.login,
            github_email: githubUser.email,
            github_avatar_url: githubUser.avatar_url,
            github_access_token: accessToken,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id);

        if (!updateError) {
          const redirectTo = request.cookies.get('post_auth_redirect')?.value || `${appUrl}/create`;
          const response = NextResponse.redirect(redirectTo);
          response.cookies.delete('github_oauth_state');
          response.cookies.delete('post_auth_redirect');
          response.cookies.delete('github_linking');
          return response;
        }

        // Update failed (github_id already belongs to another user account).
        // Merge: migrate the duplicate's chatbots to the current user, delete the duplicate, retry.
        const { data: conflictUser } = await db
          .from('users')
          .select('id')
          .eq('github_id', githubUser.id)
          .maybeSingle();

        if (conflictUser) {
          try {
            // Read the conflicting user's full data to preserve their plan if better
            const { data: conflictFull } = await db
              .from('users')
              .select('plan')
              .eq('id', conflictUser.id)
              .single();

            const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, unlimited: 3 };
            const existingRank = PLAN_RANK[existingUser.plan ?? 'free'] ?? 0;
            const conflictRank = PLAN_RANK[conflictFull?.plan ?? 'free'] ?? 0;
            const bestPlan = conflictRank > existingRank ? conflictFull!.plan : (existingUser.plan ?? 'free');

            await db.from('chatbots').update({ user_id: existingUser.id }).eq('user_id', conflictUser.id);
            await db.from('message_usage').update({ user_id: existingUser.id }).eq('user_id', conflictUser.id);
            await db.from('sessions').delete().eq('user_id', conflictUser.id);
            await db.from('users').delete().eq('id', conflictUser.id);
            const { error: retryError } = await db
              .from('users')
              .update({
                github_id: githubUser.id,
                github_username: githubUser.login,
                github_email: githubUser.email,
                github_avatar_url: githubUser.avatar_url,
                github_access_token: accessToken,
                plan: bestPlan,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingUser.id);
            if (!retryError) {
              const redirectTo = request.cookies.get('post_auth_redirect')?.value || `${appUrl}/create`;
              const mergeResponse = NextResponse.redirect(redirectTo);
              mergeResponse.cookies.delete('github_oauth_state');
              mergeResponse.cookies.delete('post_auth_redirect');
              mergeResponse.cookies.delete('github_linking');
              return mergeResponse;
            }
          } catch (mergeErr) {
            console.error('[callback] account merge error:', mergeErr);
          }
        }
        // Fall through to normal login only if merge also failed
      }
    }

    // Normal GitHub login — upsert user by github_id
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
    const redirectTo = request.cookies.get('post_auth_redirect')?.value || `${appUrl}/create`;

    const cookieDomain = process.env.NODE_ENV === 'production' ? '.botluma.com' : undefined;
    const response = NextResponse.redirect(redirectTo);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
      domain: cookieDomain,
    });
    response.cookies.delete('github_oauth_state');
    response.cookies.delete('post_auth_redirect');
    response.cookies.delete('github_linking');

    return response;
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}

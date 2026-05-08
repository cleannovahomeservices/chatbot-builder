import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('google_oauth_state')?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token from Google');

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();
    if (!googleUser.id) throw new Error('No user info from Google');

    const db = createAdminClient();

    // Try to find existing user by google_id or email
    let user;
    const { data: byGoogleId } = await db
      .from('users')
      .select('*')
      .eq('google_id', googleUser.id)
      .maybeSingle();

    if (byGoogleId) {
      // Update existing Google user
      const { data } = await db
        .from('users')
        .update({
          google_email: googleUser.email,
          google_name: googleUser.name,
          google_avatar_url: googleUser.picture,
          google_access_token: tokenData.access_token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', byGoogleId.id)
        .select()
        .single();
      user = data;
    } else {
      // Check if there's a GitHub user with same email — merge
      const { data: byEmail } = await db
        .from('users')
        .select('*')
        .eq('github_email', googleUser.email)
        .maybeSingle();

      if (byEmail) {
        const { data } = await db
          .from('users')
          .update({
            google_id: googleUser.id,
            google_email: googleUser.email,
            google_name: googleUser.name,
            google_avatar_url: googleUser.picture,
            google_access_token: tokenData.access_token,
            updated_at: new Date().toISOString(),
          })
          .eq('id', byEmail.id)
          .select()
          .single();
        user = data;
      } else {
        // Create new Google-only user
        const { data } = await db
          .from('users')
          .insert({
            google_id: googleUser.id,
            google_email: googleUser.email,
            google_name: googleUser.name,
            google_avatar_url: googleUser.picture,
            google_access_token: tokenData.access_token,
            github_username: googleUser.name,
            github_avatar_url: googleUser.picture,
          })
          .select()
          .single();
        user = data;
      }
    }

    if (!user) throw new Error('Failed to create/update user');

    const sessionToken = await createSession(user);
    const redirectTo = request.cookies.get('post_auth_redirect')?.value || `${appUrl}/dashboard`;

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
    response.cookies.delete('google_oauth_state');
    response.cookies.delete('post_auth_redirect');

    return response;
  } catch (err) {
    console.error('Google auth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}

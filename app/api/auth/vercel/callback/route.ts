import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeVercelCode, validateVercelToken } from '@/lib/vercel-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = new URL(request.url).origin;

  if (!code || !state) {
    console.error('[vercel callback] missing code or state');
    return NextResponse.redirect(`${appUrl}/?error=vercel_missing_params`);
  }

  const db = createAdminClient();
  const { data: stateRow, error: stateErr } = await db
    .from('oauth_states')
    .select('user_id, post_auth_redirect, expires_at')
    .eq('state', state)
    .eq('provider', 'vercel')
    .single();

  if (stateErr || !stateRow) {
    console.error('[vercel callback] state not found in DB:', stateErr);
    return NextResponse.redirect(`${appUrl}/?error=vercel_state_mismatch`);
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    console.error('[vercel callback] state expired');
    await db.from('oauth_states').delete().eq('state', state);
    return NextResponse.redirect(`${appUrl}/?error=vercel_state_expired`);
  }

  await db.from('oauth_states').delete().eq('state', state);

  const user = await getSession();
  if (!user || user.id !== stateRow.user_id) {
    console.error('[vercel callback] session mismatch with state owner');
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    const redirectUri = process.env.VERCEL_OAUTH_REDIRECT_URI || `${process.env.APP_BASE_URL || appUrl}/api/auth/vercel/callback`;
    console.log('[vercel callback] exchanging code, redirectUri:', redirectUri);
    const { access_token, refresh_token } = await exchangeVercelCode(code, redirectUri);
    console.log('[vercel callback] token exchange OK, has refresh_token:', !!refresh_token);

    try {
      await validateVercelToken(access_token);
    } catch (validationErr) {
      console.warn('[vercel callback] token validation warn (non-fatal):', validationErr);
    }

    const { error } = await db
      .from('users')
      .update({ vercel_access_token: access_token })
      .eq('id', user.id);

    if (error) {
      console.error('[vercel callback] DB update error:', error);
      throw new Error(`DB update failed: ${error.message}`);
    }

    const redirectTo = stateRow.post_auth_redirect || `${appUrl}/create`;
    console.log('[vercel callback] success, redirecting to:', redirectTo);
    return NextResponse.redirect(redirectTo);
  } catch (err) {
    console.error('[vercel oauth callback] fatal error:', err);
    return NextResponse.redirect(`${appUrl}/?error=vercel_auth_failed`);
  }
}

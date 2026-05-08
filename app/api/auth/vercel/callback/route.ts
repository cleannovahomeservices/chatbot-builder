import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeVercelCode, validateVercelToken } from '@/lib/vercel-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('vercel_oauth_state')?.value;
  const appUrl = new URL(request.url).origin;

  if (!code || !state || state !== storedState) {
    console.error('[vercel callback] state mismatch — stored:', storedState, 'received:', state);
    return NextResponse.redirect(`${appUrl}/?error=vercel_state_mismatch`);
  }

  const user = await getSession();
  if (!user) {
    console.error('[vercel callback] no session found');
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    const redirectUri = `${process.env.APP_BASE_URL || appUrl}/api/auth/vercel/callback`;
    console.log('[vercel callback] exchanging code, redirectUri:', redirectUri);
    const { access_token, refresh_token } = await exchangeVercelCode(code, redirectUri);
    console.log('[vercel callback] token exchange OK, has refresh_token:', !!refresh_token);

    // Validate token — non-fatal, just log if it fails
    try {
      await validateVercelToken(access_token);
    } catch (validationErr) {
      console.warn('[vercel callback] token validation warn (non-fatal):', validationErr);
    }

    const db = createAdminClient();
    // Only store vercel_access_token (vercel_refresh_token column may not exist)
    const { error } = await db
      .from('users')
      .update({ vercel_access_token: access_token })
      .eq('id', user.id);

    if (error) {
      console.error('[vercel callback] DB update error:', error);
      throw new Error(`DB update failed: ${error.message}`);
    }

    const redirectTo =
      request.cookies.get('vercel_post_auth_redirect')?.value || `${appUrl}/create`;
    console.log('[vercel callback] success, redirecting to:', redirectTo);
    const response = NextResponse.redirect(redirectTo);
    response.cookies.delete('vercel_oauth_state');
    response.cookies.delete('vercel_post_auth_redirect');

    return response;
  } catch (err) {
    console.error('[vercel oauth callback] fatal error:', err);
    return NextResponse.redirect(`${appUrl}/?error=vercel_auth_failed`);
  }
}

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
    return NextResponse.redirect(`${appUrl}/?error=vercel_auth_failed`);
  }

  const user = await getSession();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/vercel/callback`;
    const { access_token, refresh_token } = await exchangeVercelCode(code, redirectUri);

    await validateVercelToken(access_token);

    const db = createAdminClient();
    const updateData: Record<string, string | null> = { vercel_access_token: access_token };
    if (refresh_token) updateData.vercel_refresh_token = refresh_token;

    // Try with refresh token first, fall back without it if column doesn't exist
    const { error } = await db.from('users').update(updateData).eq('id', user.id);
    if (error && refresh_token) {
      await db
        .from('users')
        .update({ vercel_access_token: access_token })
        .eq('id', user.id);
    }

    const redirectTo =
      request.cookies.get('vercel_post_auth_redirect')?.value || `${appUrl}/create`;
    const response = NextResponse.redirect(redirectTo);
    response.cookies.delete('vercel_oauth_state');
    response.cookies.delete('vercel_post_auth_redirect');

    return response;
  } catch (err) {
    console.error('[vercel oauth callback]', err);
    return NextResponse.redirect(`${appUrl}/?error=vercel_auth_failed`);
  }
}

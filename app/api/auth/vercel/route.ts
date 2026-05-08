import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVercelOAuthUrl } from '@/lib/vercel-client';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const user = await getSession();
  const appUrl = new URL(request.url).origin;
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const next = new URL(request.url).searchParams.get('next') || '/create';

  // If already connected, skip OAuth
  const db = createAdminClient();
  const { data } = await db
    .from('users')
    .select('vercel_access_token')
    .eq('id', user.id)
    .single();
  if (data?.vercel_access_token) {
    return NextResponse.redirect(`${appUrl}${next}`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.APP_BASE_URL || appUrl}/api/auth/vercel/callback`;
  const oauthUrl = getVercelOAuthUrl(state, redirectUri);

  const cookieDomain = process.env.NODE_ENV === 'production' ? '.botluma.com' : undefined;
  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set('vercel_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
    domain: cookieDomain,
  });
  response.cookies.set('vercel_post_auth_redirect', `${appUrl}${next}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
    domain: cookieDomain,
  });

  return response;
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  await db
    .from('users')
    .update({ vercel_access_token: null })
    .eq('id', user.id);
  return NextResponse.json({ ok: true });
}

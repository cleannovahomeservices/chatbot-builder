import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVercelInstallUrl } from '@/lib/vercel-client';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const user = await getSession();
  const appUrl = new URL(request.url).origin;
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const next = new URL(request.url).searchParams.get('next') || '/create';

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

  const { error: insertError } = await db.from('oauth_states').insert({
    state,
    user_id: user.id,
    provider: 'vercel',
    post_auth_redirect: `${appUrl}${next}`,
  });
  if (insertError) {
    console.error('[vercel auth] failed to persist state:', insertError);
    return NextResponse.redirect(`${appUrl}/?error=vercel_state_persist_failed`);
  }

  return NextResponse.redirect(getVercelInstallUrl(state));
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 });
  }
  const token = (body.token ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });

  const userRes = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    const detail = await userRes.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: 'Token inválido o sin permisos.', detail },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { error } = await db
    .from('users')
    .update({ vercel_access_token: token })
    .eq('id', user.id);
  if (error) {
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el token' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  await db
    .from('users')
    .update({ vercel_access_token: null, vercel_team_id: null })
    .eq('id', user.id);
  return NextResponse.json({ ok: true });
}

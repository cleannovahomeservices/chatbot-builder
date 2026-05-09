import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeVercelCode, validateVercelToken } from '@/lib/vercel-client';

function errorPage(stage: string, detail: string, retryHref: string) {
  const safe = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vercel OAuth — debug</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0A0A0A;color:#fff;padding:40px;max-width:760px;margin:0 auto}h1{color:#f87171}pre{background:#1a1a1a;padding:16px;border-radius:8px;border:1px solid #333;overflow:auto;white-space:pre-wrap;word-break:break-word}.tag{display:inline-block;background:#7c3aed;padding:4px 10px;border-radius:6px;font-size:12px;margin-right:8px}a{color:#a78bfa}</style></head><body><h1>Conexión con Vercel falló</h1><p><span class="tag">Etapa: ${safe(stage)}</span></p><p>Mensaje exacto del fallo (copiar/pegar al desarrollador):</p><pre>${safe(detail)}</pre><p><a href="${safe(retryHref)}">← Volver e intentar de nuevo</a></p></body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = new URL(request.url).origin;
  const retry = `${appUrl}/create`;

  if (!code || !state) {
    return errorPage('callback_params', `code=${code ? 'present' : 'MISSING'} state=${state ? 'present' : 'MISSING'}`, retry);
  }

  const db = createAdminClient();
  const { data: stateRow, error: stateErr } = await db
    .from('oauth_states')
    .select('user_id, post_auth_redirect, expires_at')
    .eq('state', state)
    .eq('provider', 'vercel')
    .single();

  if (stateErr || !stateRow) {
    return errorPage('state_lookup', `state=${state.slice(0, 8)}... not found in DB. err=${JSON.stringify(stateErr)}`, retry);
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    await db.from('oauth_states').delete().eq('state', state);
    return errorPage('state_expired', `expires_at=${stateRow.expires_at} now=${new Date().toISOString()}`, retry);
  }

  await db.from('oauth_states').delete().eq('state', state);

  const user = await getSession();
  if (!user) {
    return errorPage('session_missing', `No active session cookie when callback was hit. (cookies were dropped between Vercel and the callback)`, `${appUrl}/login`);
  }
  if (user.id !== stateRow.user_id) {
    return errorPage('session_owner_mismatch', `session.user_id=${user.id} state.user_id=${stateRow.user_id}`, retry);
  }

  const redirectUri = process.env.VERCEL_OAUTH_REDIRECT_URI || `${process.env.APP_BASE_URL || appUrl}/api/auth/vercel/callback`;

  let access_token: string;
  try {
    const tokens = await exchangeVercelCode(code, redirectUri);
    access_token = tokens.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorPage('token_exchange', `redirectUri=${redirectUri}\nerror=${msg}`, retry);
  }

  try {
    await validateVercelToken(access_token);
  } catch (validationErr) {
    console.warn('[vercel callback] token validation warn (non-fatal):', validationErr);
  }

  const { error: updateErr } = await db
    .from('users')
    .update({ vercel_access_token: access_token })
    .eq('id', user.id);

  if (updateErr) {
    return errorPage('db_update', `users.update error: ${JSON.stringify(updateErr)}`, retry);
  }

  const redirectTo = stateRow.post_auth_redirect || `${appUrl}/create`;
  return NextResponse.redirect(redirectTo);
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const GITHUB_API = 'https://api.github.com';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'No hay sesión' }, { status: 401 });

  const token = user.github_access_token;
  if (!token) return NextResponse.json({ sessionUser: user.github_username ?? user.email_address, githubToken: null, error: 'No hay token de GitHub guardado' });

  const meRes = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });

  if (!meRes.ok) {
    return NextResponse.json({ sessionUser: user.github_username ?? user.email_address, githubToken: 'INVÁLIDO', status: meRes.status });
  }

  const me = await meRes.json();
  const scopes = meRes.headers.get('x-oauth-scopes') ?? 'no disponible';

  return NextResponse.json({
    sessionUser: user.github_username ?? user.email_address,
    tokenBelongsTo: me.login,
    tokenScopes: scopes,
    hasRepoScope: scopes.includes('repo'),
    match: (user.github_username ?? '') === me.login,
  });
}

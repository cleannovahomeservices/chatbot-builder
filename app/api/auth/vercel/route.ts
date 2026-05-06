import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateVercelToken } from '@/lib/vercel-client';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await request.json();
  if (!token?.trim()) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  try {
    const { username } = await validateVercelToken(token);
    const db = createAdminClient();
    await db.from('users').update({ vercel_access_token: token }).eq('id', user.id);
    return NextResponse.json({ ok: true, username });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token inválido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  await db.from('users').update({ vercel_access_token: null }).eq('id', user.id);
  return NextResponse.json({ ok: true });
}

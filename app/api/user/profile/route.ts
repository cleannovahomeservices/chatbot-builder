import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: 'Nombre demasiado largo' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from('users')
    .update({ display_name: name })
    .eq('id', user.id);

  if (error) {
    console.error('[profile] update error:', error);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

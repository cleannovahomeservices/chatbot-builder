import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { listVercelProjects } from '@/lib/vercel-client';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from('users')
    .select('vercel_access_token, vercel_team_id')
    .eq('id', user.id)
    .single();

  const token = data?.vercel_access_token;
  if (!token) return NextResponse.json({ error: 'Vercel no conectado' }, { status: 400 });

  try {
    const projects = await listVercelProjects(token, data?.vercel_team_id);
    return NextResponse.json({ projects });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listUserRepos } from '@/lib/github';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const repos = await listUserRepos(user.github_access_token);
  return NextResponse.json({ repos });
}

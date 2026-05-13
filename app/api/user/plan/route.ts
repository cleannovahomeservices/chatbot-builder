import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserPlanData } from '@/lib/plans';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await getUserPlanData(user.id);
  return NextResponse.json(data);
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      github_username: user.github_username,
      github_email: user.github_email,
      github_avatar_url: user.github_avatar_url,
    },
  });
}

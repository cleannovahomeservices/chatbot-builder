import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { generateSystemPrompt } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { input } = await request.json();
  if (!input?.trim()) return NextResponse.json({ error: 'Input requerido' }, { status: 400 });

  try {
    const prompt = await generateSystemPrompt(input);
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error('Generate prompt error:', err);
    return NextResponse.json({ error: 'Error generando el prompt' }, { status: 500 });
  }
}

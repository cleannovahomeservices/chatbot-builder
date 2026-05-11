import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory conversation history per session (TTL: 30 min)
type Message = { role: 'user' | 'assistant'; content: string };
const sessions = new Map<string, { messages: Message[]; lastAt: number }>();
const SESSION_TTL = 30 * 60 * 1000;

function getHistory(sessionId: string): Message[] {
  const s = sessions.get(sessionId);
  if (!s || Date.now() - s.lastAt > SESSION_TTL) return [];
  return s.messages;
}

function pushHistory(sessionId: string, role: 'user' | 'assistant', content: string) {
  const s = sessions.get(sessionId);
  const messages: Message[] = s ? [...s.messages, { role, content }] : [{ role, content }];
  sessions.set(sessionId, { messages: messages.slice(-20), lastAt: Date.now() });
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function POST(request: NextRequest) {
  const { chatbotId, webhookUrl, message, sessionId } = await request.json();
  if ((!chatbotId && !webhookUrl) || !message) {
    return NextResponse.json({ error: 'Faltan chatbotId (o webhookUrl) y message' }, { status: 400 });
  }

  const db = createAdminClient();
  const query = db.from('chatbots').select('system_prompt');
  const { data: chatbot } = chatbotId
    ? await query.eq('id', chatbotId).maybeSingle()
    : await query.eq('n8n_webhook_url', webhookUrl).maybeSingle();

  if (!chatbot?.system_prompt) {
    return NextResponse.json({ output: 'Este chatbot no está configurado todavía.' }, { headers: CORS });
  }

  const history = getHistory(sessionId);
  pushHistory(sessionId, 'user', message);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: chatbot.system_prompt,
    messages: [...history, { role: 'user', content: message }],
  });

  const output = response.content[0].type === 'text' ? response.content[0].text : 'Sin respuesta';
  pushHistory(sessionId, 'assistant', output);

  return NextResponse.json({ output }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

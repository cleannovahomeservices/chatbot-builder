import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAndIncrementMessage } from '@/lib/plans';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const query = db.from('chatbots').select('system_prompt, user_id');
  const { data: chatbot } = chatbotId
    ? await query.eq('id', chatbotId).maybeSingle()
    : await query.eq('n8n_webhook_url', webhookUrl).maybeSingle();

  if (!chatbot?.system_prompt) {
    return NextResponse.json({ output: 'Este chatbot no está configurado todavía.' }, { headers: CORS });
  }

  const allowed = await checkAndIncrementMessage(chatbot.user_id);
  if (!allowed) {
    return NextResponse.json(
      { output: 'Este chatbot ha alcanzado el límite de mensajes de su plan. El propietario puede ampliarlo en botluma.com.' },
      { headers: CORS }
    );
  }

  const history = getHistory(sessionId);
  pushHistory(sessionId, 'user', message);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    messages: [
      { role: 'system', content: chatbot.system_prompt },
      ...history,
      { role: 'user', content: message },
    ],
  });

  const output = response.choices[0]?.message?.content ?? 'Sin respuesta';
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

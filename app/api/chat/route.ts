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

type DbClient = ReturnType<typeof createAdminClient>;

// Persiste la conversación y sus mensajes (best-effort: nunca rompe el chat).
async function persistTurn(
  db: DbClient,
  chatbotId: string,
  ownerId: string,
  sessionId: string,
  userText: string,
  botText: string,
) {
  try {
    // Ignora las sesiones de prueba del Probador/iframe (prefijo test-)
    if (!sessionId || sessionId.startsWith('test-')) return;
    // Busca o crea la conversación (chatbot_id + session_id es único)
    const { data: existing } = await db
      .from('conversations')
      .select('id, message_count')
      .eq('chatbot_id', chatbotId)
      .eq('session_id', sessionId)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;
    const prevCount = existing?.message_count ?? 0;

    if (!conversationId) {
      const { data: created } = await db
        .from('conversations')
        .insert({ chatbot_id: chatbotId, user_id: ownerId, session_id: sessionId })
        .select('id')
        .single();
      conversationId = created?.id;
    }
    if (!conversationId) return;

    await db.from('messages').insert([
      { conversation_id: conversationId, role: 'user', content: userText },
      { conversation_id: conversationId, role: 'assistant', content: botText },
    ]);

    await db
      .from('conversations')
      .update({ last_at: new Date().toISOString(), message_count: prevCount + 2 })
      .eq('id', conversationId);
  } catch (e) {
    console.error('[chat] persist error:', e);
  }
}

export async function POST(request: NextRequest) {
  const { chatbotId, webhookUrl, message, sessionId } = await request.json();
  if ((!chatbotId && !webhookUrl) || !message) {
    return NextResponse.json({ error: 'Faltan chatbotId (o webhookUrl) y message' }, { status: 400 });
  }

  const db = createAdminClient();
  const query = db.from('chatbots').select('id, system_prompt, user_id');
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

  await persistTurn(db, chatbot.id, chatbot.user_id, sessionId, message, output);

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

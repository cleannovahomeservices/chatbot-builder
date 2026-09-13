import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_USER_MESSAGES = 200;

// GET /api/chatbots/[id]/insights
// Analiza los mensajes reales de los visitantes y devuelve un resumen:
// temas, preguntas frecuentes, huecos y sugerencias.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: bot } = await db
    .from('chatbots')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Mensajes de visitantes (role=user) de las conversaciones de este chatbot
  const { data: rows } = await db
    .from('messages')
    .select('content, created_at, conversations!inner(chatbot_id)')
    .eq('conversations.chatbot_id', id)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(MAX_USER_MESSAGES);

  const messages = (rows ?? []).map((r) => (r.content as string)).filter(Boolean);

  if (messages.length < 3) {
    return NextResponse.json({ ready: false, count: messages.length });
  }

  const corpus = messages.slice().reverse().join('\n- ');

  const system = `Eres un analista de negocio. Te doy los mensajes que los visitantes han escrito al chatbot de "${bot.name}". Resume qué quiere la gente para ayudar al dueño del negocio. Responde SOLO con JSON válido con esta forma exacta:
{
  "summary": "2-3 frases en español sobre qué busca la gente en general",
  "topics": [{"title": "tema corto", "detail": "1 frase", "share": "alto|medio|bajo"}],
  "unanswered": ["preguntas o necesidades que el bot probablemente no supo resolver"],
  "sentiment": "positivo|neutral|negativo",
  "suggestions": ["acciones concretas para el dueño del negocio"]
}
Máximo 6 topics, 5 unanswered, 5 suggestions. Todo en español.`;

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Mensajes de visitantes (${messages.length}):\n- ${corpus}` },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? '{}';
    const insights = JSON.parse(raw);
    return NextResponse.json({ ready: true, count: messages.length, insights });
  } catch (e) {
    console.error('[insights] error:', e);
    return NextResponse.json({ error: 'No se pudo analizar ahora mismo.' }, { status: 500 });
  }
}

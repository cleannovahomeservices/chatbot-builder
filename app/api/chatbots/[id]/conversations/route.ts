import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/chatbots/[id]/conversations
//   -> lista de conversaciones del chatbot
// GET /api/chatbots/[id]/conversations?conversationId=xxx
//   -> mensajes de esa conversación
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // El chatbot tiene que ser del usuario
  const { data: bot } = await db
    .from('chatbots')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const conversationId = request.nextUrl.searchParams.get('conversationId');

  if (conversationId) {
    // Verifica que la conversación es de este chatbot
    const { data: conv } = await db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('chatbot_id', id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: messages } = await db
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ messages: messages ?? [] });
  }

  const { data: conversations } = await db
    .from('conversations')
    .select('id, session_id, started_at, last_at, message_count, needs_attention, lead_name, lead_email, lead_phone')
    .eq('chatbot_id', id)
    .order('last_at', { ascending: false })
    .limit(200);

  return NextResponse.json({ conversations: conversations ?? [] });
}

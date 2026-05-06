import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkflow, setWorkflowActive } from '@/lib/n8n';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: chatbot } = await db
    .from('chatbots')
    .select('n8n_workflow_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (chatbot?.n8n_workflow_id) {
    try { await deleteWorkflow(chatbot.n8n_workflow_id); } catch {}
  }

  const { error } = await db
    .from('chatbots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status } = await request.json();

  if (!['active', 'inactive'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: chatbot } = await db
    .from('chatbots')
    .select('n8n_workflow_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (chatbot?.n8n_workflow_id) {
    try { await setWorkflowActive(chatbot.n8n_workflow_id, status === 'active'); } catch {}
  }

  const { data, error } = await db
    .from('chatbots')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chatbot: data });
}

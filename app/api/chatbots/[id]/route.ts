import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkflow } from '@/lib/n8n';
import { removeWidget, injectWidget } from '@/lib/github';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: chatbot } = await db
    .from('chatbots')
    .select('n8n_workflow_id, github_repo, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove widget from GitHub repo
  if (chatbot.github_repo && user.github_access_token) {
    const [owner, repo] = chatbot.github_repo.split('/');
    try { await removeWidget(user.github_access_token, owner, repo, chatbot.name); } catch {}
  }

  // Delete workflow from n8n
  if (chatbot.n8n_workflow_id) {
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
  const appUrl = new URL(request.url).origin;

  const { data: chatbot } = await db
    .from('chatbots')
    .select('n8n_workflow_id, github_repo, name, n8n_webhook_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (chatbot.github_repo && user.github_access_token) {
    const [owner, repo] = chatbot.github_repo.split('/');
    try {
      if (status === 'inactive') {
        // Remove widget from code
        await removeWidget(user.github_access_token, owner, repo, chatbot.name);
      } else {
        // Re-inject widget into code
        await injectWidget(user.github_access_token, owner, repo, chatbot.n8n_webhook_url, chatbot.name, appUrl);
      }
    } catch (e) {
      console.error(`[toggle] GitHub error:`, e);
    }
  }

  const { data, error } = await db
    .from('chatbots')
    .update({ status, widget_injected: status === 'active' })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chatbot: data });
}

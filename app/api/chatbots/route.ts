import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createChatbotWorkflow } from '@/lib/n8n';
import { injectWidget } from '@/lib/github';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, systemPrompt, githubRepo } = await request.json();
  if (!name || !systemPrompt || !githubRepo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const db = createAdminClient();
  const webhookPath = `cb-${crypto.randomBytes(8).toString('hex')}`;

  try {
    const { workflowId, webhookUrl } = await createChatbotWorkflow(name, systemPrompt, webhookPath);

    const [owner, repo] = githubRepo.split('/');
    await injectWidget(user.github_access_token, owner, repo, webhookUrl, name);

    const { data: chatbot, error } = await db
      .from('chatbots')
      .insert({
        user_id: user.id,
        name,
        system_prompt: systemPrompt,
        n8n_workflow_id: workflowId,
        n8n_webhook_url: webhookUrl,
        github_repo: githubRepo,
        widget_injected: true,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ chatbot });
  } catch (err) {
    console.error('Create chatbot error:', err);
    return NextResponse.json({ error: 'Error creando el chatbot' }, { status: 500 });
  }
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data: chatbots } = await db
    .from('chatbots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ chatbots: chatbots ?? [] });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createChatbotWorkflow } from '@/lib/n8n';
import { injectWidget } from '@/lib/github';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, systemPrompt, githubRepo, vercelProjectId, vercelProjectName, vercelGithubRepo } =
    await request.json();
  if (!name || !systemPrompt || (!githubRepo && !vercelProjectId)) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const db = createAdminClient();
  const webhookPath = `cb-${crypto.randomBytes(8).toString('hex')}`;

  let step = 'n8n';
  try {
    const { workflowId, webhookUrl } = await createChatbotWorkflow(name, systemPrompt, webhookPath);

    step = 'github';
    let widgetInjected = false;
    const targetRepo = githubRepo ?? vercelGithubRepo;

    if (targetRepo) {
      const [owner, repo] = targetRepo.split('/');
      await injectWidget(user.github_access_token, owner, repo, webhookUrl, name);
      widgetInjected = true;
    }

    step = 'supabase';
    const { data: chatbot, error } = await db
      .from('chatbots')
      .insert({
        user_id: user.id,
        name,
        system_prompt: systemPrompt,
        n8n_workflow_id: workflowId,
        n8n_webhook_url: webhookUrl,
        github_repo: targetRepo ?? vercelProjectName ?? null,
        widget_injected: widgetInjected,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ chatbot });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Create chatbot error [${step}]:`, msg);
    return NextResponse.json({ error: `Error en ${step}: ${msg}` }, { status: 500 });
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

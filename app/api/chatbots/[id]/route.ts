import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkflow, updateWorkflowSystemPrompt } from '@/lib/n8n';
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
  const body = await request.json();

  const db = createAdminClient();
  const appUrl = new URL(request.url).origin;

  // --- Customize action: update colors, system prompt, re-inject widget ---
  if (body.action === 'customize') {
    const { primaryColor, secondaryColor, widgetStyle, iconType, systemPrompt } = body as {
      primaryColor?: string;
      secondaryColor?: string;
      widgetStyle?: string;
      iconType?: string;
      systemPrompt?: string;
    };

    const { data: chatbot } = await db
      .from('chatbots')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const primary = primaryColor || chatbot.primary_color || '#7c3aed';
    const secondary = secondaryColor || chatbot.secondary_color || '#4338ca';
    const style = widgetStyle || chatbot.widget_style || 'bubble';
    const icon = iconType || chatbot.icon_type || 'chat';
    const prompt = systemPrompt !== undefined ? systemPrompt : chatbot.system_prompt;

    // Update n8n system prompt if changed
    if (systemPrompt !== undefined && systemPrompt !== chatbot.system_prompt && chatbot.n8n_workflow_id) {
      try {
        await updateWorkflowSystemPrompt(chatbot.n8n_workflow_id, systemPrompt);
      } catch (e) {
        console.error('[customize] n8n update error:', e);
      }
    }

    // Re-inject widget with new colors
    if (chatbot.github_repo && user.github_access_token && chatbot.status === 'active') {
      const [owner, repo] = chatbot.github_repo.split('/');
      try {
        await injectWidget(
          user.github_access_token, owner, repo,
          chatbot.n8n_webhook_url, chatbot.name, appUrl,
          primary, secondary, style, icon,
        );
      } catch (e) {
        console.error('[customize] GitHub re-inject error:', e);
      }
    }

    // Persist to DB (graceful fallback if color columns don't exist)
    const updatePayload: Record<string, unknown> = { system_prompt: prompt };
    let result = await db
      .from('chatbots')
      .update({ ...updatePayload, primary_color: primary, secondary_color: secondary, widget_style: style, icon_type: icon })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (result.error?.message?.includes('icon_type')) {
      result = await db
        .from('chatbots')
        .update({ ...updatePayload, primary_color: primary, secondary_color: secondary, widget_style: style })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    }

    if (result.error?.message?.includes('primary_color') || result.error?.message?.includes('secondary_color') || result.error?.message?.includes('widget_style')) {
      result = await db
        .from('chatbots')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ chatbot: result.data });
  }

  // --- Status toggle action ---
  const { status } = body;

  if (!['active', 'inactive'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: chatbot } = await db
    .from('chatbots')
    .select('n8n_workflow_id, github_repo, name, n8n_webhook_url, primary_color, secondary_color, widget_style, icon_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (chatbot.github_repo && user.github_access_token) {
    const [owner, repo] = chatbot.github_repo.split('/');
    try {
      if (status === 'inactive') {
        await removeWidget(user.github_access_token, owner, repo, chatbot.name);
      } else {
        await injectWidget(
          user.github_access_token, owner, repo,
          chatbot.n8n_webhook_url, chatbot.name, appUrl,
          chatbot.primary_color || '#7c3aed',
          chatbot.secondary_color || '#4338ca',
          chatbot.widget_style || 'bubble',
          chatbot.icon_type || 'chat',
        );
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

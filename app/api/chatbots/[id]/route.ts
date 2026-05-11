import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
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
    .select('github_repo, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove widget from GitHub repo
  if (chatbot.github_repo && user.github_access_token) {
    const [owner, repo] = chatbot.github_repo.split('/');
    try { await removeWidget(user.github_access_token, owner, repo, chatbot.name); } catch {}
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
    const { primaryColor, secondaryColor, widgetStyle, iconType, systemPrompt, name, greeting } = body as {
      primaryColor?: string;
      secondaryColor?: string;
      widgetStyle?: string;
      iconType?: string;
      systemPrompt?: string;
      name?: string;
      greeting?: string;
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
    const updatedName = name?.trim() || chatbot.name;
    const updatedGreeting = greeting !== undefined ? greeting : (chatbot.greeting ?? '¡Hola! ¿En qué puedo ayudarte hoy?');

    // Re-inject widget with new config
    if (chatbot.github_repo && user.github_access_token && chatbot.status === 'active') {
      const [owner, repo] = chatbot.github_repo.split('/');
      try {
        await injectWidget(
          user.github_access_token, owner, repo,
          chatbot.id, updatedName, appUrl,
          primary, secondary, style, icon, updatedGreeting,
        );
      } catch (e) {
        console.error('[customize] GitHub re-inject error:', e);
      }
    }

    // Persist to DB (graceful fallback if color columns don't exist)
    const updatePayload: Record<string, unknown> = {
      system_prompt: prompt,
      name: updatedName,
      greeting: updatedGreeting,
    };
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

  // --- Reinject action ---
  if (body.action === 'reinject') {
    const { data: chatbot } = await db
      .from('chatbots')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let injected = false;
    let message = '';

    // Try GitHub first (repo stored as "owner/repo")
    if (chatbot.github_repo?.includes('/') && user.github_access_token) {
      const [owner, repo] = chatbot.github_repo.split('/');
      try {
        const result = await injectWidget(
          user.github_access_token, owner, repo,
          chatbot.id, chatbot.name, appUrl,
          chatbot.primary_color || '#7c3aed',
          chatbot.secondary_color || '#4338ca',
          chatbot.widget_style || 'bubble',
          chatbot.icon_type || 'chat',
          chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
        );
        injected = result.injected;
        message = result.injected ? `Inyectado en ${result.file}` : (result.reason ?? 'Error desconocido');
      } catch (e) {
        message = e instanceof Error ? e.message : 'Error GitHub';
      }
    }

    if (!injected && !message) message = 'No se pudo reconectar — conecta GitHub para inyección automática';

    if (injected) {
      await db.from('chatbots').update({ widget_injected: true, updated_at: new Date().toISOString() }).eq('id', id);
    }

    return NextResponse.json({ ok: injected, message });
  }

  // --- Status toggle action ---
  const { status } = body;

  if (!['active', 'inactive'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: chatbot } = await db
    .from('chatbots')
    .select('github_repo, name, primary_color, secondary_color, widget_style, icon_type, greeting')
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
          id, chatbot.name, appUrl,
          chatbot.primary_color || '#7c3aed',
          chatbot.secondary_color || '#4338ca',
          chatbot.widget_style || 'bubble',
          chatbot.icon_type || 'chat',
          chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
        );
      }
    } catch (e) {
      console.error(`[toggle] GitHub error:`, e);
    }
  }

  const { data, error } = await db
    .from('chatbots')
    .update({ status, widget_injected: status === 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chatbot: data });
}

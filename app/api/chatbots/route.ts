import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { injectWidget } from '@/lib/github';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    name, systemPrompt, githubRepo,
    primaryColor, secondaryColor, widgetStyle, iconType, sourceUrl, greeting,
  } = await request.json();

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const colors = {
    primary: (primaryColor as string | undefined) || '#7c3aed',
    secondary: (secondaryColor as string | undefined) || '#4338ca',
    style: (widgetStyle as string | undefined) || 'bubble',
    icon: (iconType as string | undefined) || 'chat',
  };

  const appUrl = new URL(request.url).origin;
  const db = createAdminClient();

  let step = 'supabase';
  try {
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      name,
      system_prompt: systemPrompt,
      n8n_workflow_id: null,
      n8n_webhook_url: null,
      github_repo: githubRepo ?? null,
      vercel_project_id: null,
      widget_injected: false,
      status: 'active',
    };

    const defaultGreeting = (greeting as string | undefined)?.trim() || '¡Hola! ¿En qué puedo ayudarte hoy?';
    // Try to include color columns (they may not exist yet if migration hasn't run)
    let result = await db.from('chatbots').insert({ ...insertData, primary_color: colors.primary, secondary_color: colors.secondary, widget_style: colors.style, icon_type: colors.icon, source_url: sourceUrl || null, greeting: defaultGreeting }).select().single();

    if (result.error?.message?.includes('primary_color') || result.error?.message?.includes('secondary_color') || result.error?.message?.includes('source_url') || result.error?.message?.includes('widget_style') || result.error?.message?.includes('icon_type')) {
      result = await db.from('chatbots').insert({ ...insertData, primary_color: colors.primary, secondary_color: colors.secondary, widget_style: colors.style, source_url: sourceUrl || null }).select().single();
    }

    if (result.error?.message?.includes('primary_color') || result.error?.message?.includes('secondary_color') || result.error?.message?.includes('source_url') || result.error?.message?.includes('widget_style')) {
      result = await db.from('chatbots').insert(insertData).select().single();
    }

    if (result.error) throw result.error;

    const chatbotId = result.data.id;

    step = 'github';
    let widgetInjected = false;
    let injectReason: string | undefined;
    let injectFile: string | undefined;
    let injectPrUrl: string | undefined;
    if (githubRepo && user.github_access_token) {
      const [owner, repo] = githubRepo.split('/');
      const injectResult = await injectWidget(
        user.github_access_token, owner, repo, chatbotId, name, appUrl,
        colors.primary, colors.secondary, colors.style, colors.icon,
      );
      widgetInjected = injectResult.injected;
      injectReason = injectResult.reason;
      injectFile = injectResult.file;
      injectPrUrl = injectResult.prUrl;
    } else if (!user.github_access_token) {
      injectReason = 'no GitHub token on account';
    }

    if (widgetInjected) {
      await db.from('chatbots').update({ widget_injected: true }).eq('id', chatbotId);
    }

    return NextResponse.json({ chatbot: result.data, injectFile, injectReason, injectPrUrl });
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

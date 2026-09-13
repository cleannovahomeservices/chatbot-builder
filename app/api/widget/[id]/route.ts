import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Config pública del widget en vivo. La lee widget.js en cada carga, así los
// cambios (colores, avatar, saludo, contacto, branding) se aplican al instante
// SIN re-inyectar ni volver a desplegar la web del cliente.
const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: bot } = await db
    .from('chatbots')
    .select('name, greeting, primary_color, secondary_color, widget_style, icon_type, avatar_url, hide_branding, handoff_whatsapp, handoff_email, booking_url, status')
    .eq('id', id)
    .maybeSingle();

  if (!bot) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: CORS });
  }

  return NextResponse.json(
    {
      name: bot.name,
      greeting: bot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
      primaryColor: bot.primary_color || '#7c3aed',
      secondaryColor: bot.secondary_color || '#4338ca',
      style: bot.widget_style || 'bubble',
      icon: bot.icon_type || 'chat',
      avatarUrl: bot.avatar_url || '',
      hideBranding: !!bot.hide_branding,
      handoffWhatsapp: bot.handoff_whatsapp || '',
      handoffEmail: bot.handoff_email || '',
      bookingUrl: bot.booking_url || '',
      status: bot.status || 'active',
    },
    { headers: { ...CORS, 'Cache-Control': 'public, max-age=30' } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}

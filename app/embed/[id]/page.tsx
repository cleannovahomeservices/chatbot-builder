import { createAdminClient } from '@/lib/supabase/admin';
import { InlineChat } from '@/components/inline-chat';
import { notFound } from 'next/navigation';

// Chat embebido a pantalla completa dentro de un iframe. Público (sin sesión):
// solo expone lo necesario para chatear, igual que hace el widget.js.
export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: bot } = await db
    .from('chatbots')
    .select('id, name, greeting, primary_color, secondary_color, avatar_url, handoff_whatsapp, handoff_email, booking_url, status')
    .eq('id', id)
    .maybeSingle();

  if (!bot) notFound();

  return (
    <div className="fixed inset-0">
      <InlineChat
        chatbotId={bot.id}
        name={bot.name}
        greeting={bot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?'}
        primaryColor={bot.primary_color || '#7c3aed'}
        secondaryColor={bot.secondary_color || '#4338ca'}
        avatarUrl={bot.avatar_url}
        handoffWhatsapp={bot.handoff_whatsapp}
        handoffEmail={bot.handoff_email}
        bookingUrl={bot.booking_url}
      />
    </div>
  );
}

"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Chatbot } from '@/lib/types';
import { buildMarkdown, type WidgetSnippetConfig } from '@/lib/widget-snippet';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chatbot-builder-iota.vercel.app';

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ChatbotCard({ chatbot: initial }: { chatbot: Chatbot }) {
  const [chatbot, setChatbot] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const isDownloaded = !chatbot.github_repo;
  const detailHref = `/dashboard/chatbots/${chatbot.id}`;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  async function deleteBot(e: React.MouseEvent) {
    stop(e);
    if (!confirm(`¿Borrar el chatbot "${chatbot.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/chatbots/${chatbot.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function toggleStatus(e: React.MouseEvent) {
    stop(e);
    const newStatus = chatbot.status === 'active' ? 'inactive' : 'active';
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.chatbot) setChatbot(data.chatbot);
    } finally {
      setLoading(false);
    }
  }

  function redownload(e: React.MouseEvent) {
    stop(e);
    const cfg: WidgetSnippetConfig = {
      chatbotId: chatbot.id,
      name: chatbot.name,
      primaryColor: chatbot.primary_color || '#7c3aed',
      secondaryColor: chatbot.secondary_color || '#4338ca',
      style: chatbot.widget_style || 'bubble',
      icon: chatbot.icon_type || 'chat',
      greeting: chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
      avatarUrl: chatbot.avatar_url,
      hideBranding: chatbot.hide_branding,
      handoffWhatsapp: chatbot.handoff_whatsapp,
      handoffEmail: chatbot.handoff_email,
      bookingUrl: chatbot.booking_url,
    };
    const md = buildMarkdown(cfg, APP_URL);
    downloadFile(md, `chatbot-${chatbot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`);
  }

  return (
    <div
      onClick={() => router.push(detailHref)}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 cursor-pointer hover:border-white/20 hover:bg-white/[0.05] transition-colors"
    >
      {/* Name + badges */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {chatbot.avatar_url ? (
            <img src={chatbot.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/10" />
          ) : (
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10"
              style={{ background: `linear-gradient(135deg, ${chatbot.primary_color || '#7c3aed'}, ${chatbot.secondary_color || '#4338ca'})` }}
            />
          )}
          <h2 className="font-semibold text-base sm:text-lg">{chatbot.name}</h2>
          {isDownloaded ? (
            <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10 whitespace-nowrap">
              Descargado
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${chatbot.status === 'active' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-white/40 bg-white/5'}`}>
              {chatbot.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
          )}
          {!isDownloaded && chatbot.widget_injected && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10 whitespace-nowrap">
              Widget inyectado
            </span>
          )}
        </div>
        <span className="hidden sm:block text-xs text-white/25 shrink-0 mt-0.5" title={`Creado: ${new Date(chatbot.created_at).toLocaleDateString('es-ES')}`}>
          {new Date(chatbot.updated_at ?? chatbot.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Repo / status text */}
      {isDownloaded ? (
        <p className="text-xs sm:text-sm text-white/30 italic">Sin repositorio — integrado manualmente</p>
      ) : (
        <p className="text-xs sm:text-sm text-white/40 break-all">{chatbot.github_repo}</p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
        <span className="sm:hidden text-xs text-white/25">
          {new Date(chatbot.updated_at ?? chatbot.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={(e) => { stop(e); router.push(detailHref); }}
            disabled={loading || deleting}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:bg-white/5 hover:border-white/30 transition-colors cursor-pointer disabled:opacity-40"
          >
            Abrir panel
          </button>
          {isDownloaded ? (
            <button
              onClick={redownload}
              disabled={loading || deleting}
              className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors cursor-pointer disabled:opacity-40"
            >
              Re-descargar
            </button>
          ) : (
            <button
              onClick={toggleStatus}
              disabled={loading || deleting}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${chatbot.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
            >
              {loading ? '…' : chatbot.status === 'active' ? 'Desactivar' : 'Activar'}
            </button>
          )}
          <button
            onClick={deleteBot}
            disabled={loading || deleting}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/30 hover:border-red-500/30 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
          >
            {deleting ? '…' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

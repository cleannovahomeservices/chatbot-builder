"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Chatbot {
  id: string;
  name: string;
  github_repo: string;
  n8n_webhook_url: string;
  status: string;
  widget_injected: boolean;
  created_at: string;
}

export function ChatbotCard({ chatbot: initial }: { chatbot: Chatbot }) {
  const [chatbot, setChatbot] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function deleteBot() {
    if (!confirm(`¿Borrar el chatbot "${chatbot.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/chatbots/${chatbot.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function toggleStatus() {
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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="font-semibold text-lg truncate">{chatbot.name}</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                chatbot.status === 'active'
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                  : 'border-white/10 text-white/40 bg-white/5'
              }`}
            >
              {chatbot.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
            {chatbot.widget_injected && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                Widget inyectado
              </span>
            )}
          </div>
          <p className="text-sm text-white/40 mb-3">{chatbot.github_repo}</p>
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
            <span className="text-xs text-white/30 shrink-0">Webhook:</span>
            <span className="text-xs font-mono text-violet-300 truncate">
              {chatbot.n8n_webhook_url}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <span className="text-xs text-white/25">
            {new Date(chatbot.created_at).toLocaleDateString('es-ES')}
          </span>
          <button
            onClick={toggleStatus}
            disabled={loading || deleting}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
              chatbot.status === 'active'
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            {loading ? '…' : chatbot.status === 'active' ? 'Desactivar' : 'Activar'}
          </button>
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

"use client";

import { useEffect, useState } from 'react';

interface ConversationRow {
  id: string;
  session_id: string;
  started_at: string;
  last_at: string;
  message_count: number;
  needs_attention: boolean;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ConversationsPanel({ chatbotId }: { chatbotId: string }) {
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}/conversations`)
      .then((r) => r.json())
      .then((d) => setConvs(d.conversations ?? []))
      .catch(() => setConvs([]));
  }, [chatbotId]);

  useEffect(() => {
    if (!selected) { setMessages(null); return; }
    setLoadingMsgs(true);
    fetch(`/api/chatbots/${chatbotId}/conversations?conversationId=${selected}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [selected, chatbotId]);

  if (convs === null) {
    return <p className="text-sm text-white/40">Cargando conversaciones…</p>;
  }

  if (convs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-white/50">Todavía no hay conversaciones.</p>
        <p className="text-xs text-white/30 mt-2">
          Aquí verás cada chat real de tus visitantes (las pruebas del Probador no se guardan).
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      {/* Lista */}
      <div className="rounded-2xl border border-white/10 overflow-hidden max-h-[560px] overflow-y-auto">
        {convs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`w-full text-left px-4 py-3 border-b border-white/[0.06] transition cursor-pointer ${
              selected === c.id ? 'bg-violet-600/15' : 'hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2">
              {c.needs_attention && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Necesita tu atención" />}
              <span className="text-sm text-white/85 truncate">
                {c.lead_name || `Visitante ${c.session_id.slice(-4)}`}
              </span>
              <span className="ml-auto text-xs text-white/30 shrink-0">{c.message_count} msj</span>
            </div>
            <div className="text-xs text-white/35 mt-1">{fmt(c.last_at)}</div>
            {(c.lead_email || c.lead_phone) && (
              <div className="text-xs text-violet-300/80 mt-1 truncate">{c.lead_email || c.lead_phone}</div>
            )}
          </button>
        ))}
      </div>

      {/* Transcripción */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 min-h-[560px] max-h-[560px] overflow-y-auto">
        {!selected ? (
          <p className="text-sm text-white/40 text-center mt-8">Elige una conversación para leerla.</p>
        ) : loadingMsgs ? (
          <p className="text-sm text-white/40">Cargando…</p>
        ) : messages && messages.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'self-end bg-violet-600/25 text-white rounded-br-sm'
                    : 'self-start bg-white/[0.07] text-white/85 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">Sin mensajes.</p>
        )}
      </div>
    </div>
  );
}

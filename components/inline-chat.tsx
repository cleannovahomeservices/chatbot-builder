"use client";

import { useEffect, useRef, useState } from 'react';

export interface InlineChatProps {
  chatbotId: string;
  name: string;
  greeting?: string;
  primaryColor?: string;
  secondaryColor?: string;
  avatarUrl?: string | null;
  handoffWhatsapp?: string | null;
  handoffEmail?: string | null;
  bookingUrl?: string | null;
  /** URL absoluta de la API de chat; por defecto usa la ruta relativa (mismo origen). */
  apiUrl?: string;
}

type Msg = { role: 'user' | 'bot'; text: string };

export function InlineChat({
  chatbotId,
  name,
  greeting = '¡Hola! ¿En qué puedo ayudarte hoy?',
  primaryColor = '#7c3aed',
  secondaryColor = '#4338ca',
  avatarUrl,
  handoffWhatsapp,
  handoffEmail,
  bookingUrl,
  apiUrl = '/api/chat',
}: InlineChatProps) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'bot', text: greeting }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionRef = useRef('test-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reinicia el saludo si cambia (útil en el Probador al editar en vivo)
  useEffect(() => {
    setMessages((m) => (m.length <= 1 ? [{ role: 'bot', text: greeting }] : m));
  }, [greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const grad = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
  const waNum = (handoffWhatsapp || '').replace(/[^0-9]/g, '');
  const hasActions = !!(waNum || handoffEmail || bookingUrl);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId, message: text, sessionId: sessionRef.current }),
      });
      const d = await r.json();
      setMessages((m) => [...m, { role: 'bot', text: d.output || d.text || d.message || d.response || 'Sin respuesta' }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'Error al conectar. Inténtalo de nuevo.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0d0d0d]">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5 px-4 py-3 text-white text-sm font-semibold shrink-0" style={{ background: grad }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        )}
        <span className="truncate">{name}</span>
      </div>

      {/* Acciones rápidas (WhatsApp / email / cita) */}
      {hasActions && (
        <div className="flex flex-wrap gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/5 shrink-0">
          {waNum && (
            <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2.5 py-1.5 rounded-full" style={{ background: primaryColor }}>
              💬 WhatsApp
            </a>
          )}
          {handoffEmail && (
            <a href={`mailto:${handoffEmail}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2.5 py-1.5 rounded-full" style={{ background: primaryColor }}>
              ✉️ Email
            </a>
          )}
          {bookingUrl && (
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2.5 py-1.5 rounded-full" style={{ background: primaryColor }}>
              📅 Reservar cita
            </a>
          )}
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ? 'self-end text-white rounded-br-sm' : 'self-start bg-white/[0.07] text-white/90 rounded-bl-sm'
            }`}
            style={m.role === 'user' ? { background: grad } : undefined}
          >
            {m.text}
          </div>
        ))}
        {sending && (
          <div className="self-start bg-white/[0.07] text-white/50 px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-[13px]">…</div>
        )}
      </div>

      {/* Entrada */}
      <div className="flex gap-2 p-3 border-t border-white/10 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Escribe un mensaje…"
          className="flex-1 bg-white/[0.07] border border-white/10 text-white placeholder-white/30 px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-white/25"
        />
        <button
          onClick={send}
          disabled={sending}
          className="text-white rounded-xl px-4 text-lg leading-none disabled:opacity-50 cursor-pointer"
          style={{ background: grad }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

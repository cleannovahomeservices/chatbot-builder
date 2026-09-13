"use client";

import { useCallback, useEffect, useState } from 'react';

interface Insights {
  summary?: string;
  topics?: { title: string; detail?: string; share?: string }[];
  unanswered?: string[];
  sentiment?: string;
  suggestions?: string[];
}

interface Result {
  ready: boolean;
  count: number;
  insights?: Insights;
  error?: string;
}

const shareColor: Record<string, string> = {
  alto: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  medio: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  bajo: 'border-white/15 text-white/50 bg-white/5',
};

const sentimentLabel: Record<string, string> = {
  positivo: '🙂 Positivo',
  neutral: '😐 Neutral',
  negativo: '🙁 Negativo',
};

export function InsightsPanel({ chatbotId }: { chatbotId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`/api/chatbots/${chatbotId}/insights`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Error');
        setData(d);
      })
      .catch((e) => setError(e.message || 'No se pudo analizar'))
      .finally(() => setLoading(false));
  }, [chatbotId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="text-sm text-white/40">Analizando las conversaciones con IA…</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition cursor-pointer">Reintentar</button>
      </div>
    );
  }

  if (data && !data.ready) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-white/50">Aún no hay suficientes conversaciones para analizar.</p>
        <p className="text-xs text-white/30 mt-2">Necesitas al menos unas cuantas charlas reales de visitantes. Vuelve cuando tu bot lleve un tiempo instalado.</p>
      </div>
    );
  }

  const ins = data?.insights ?? {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">Basado en {data?.count} mensajes de visitantes</p>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 transition cursor-pointer">↻ Actualizar</button>
      </div>

      {ins.summary && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/85 leading-relaxed">{ins.summary}</p>
          {ins.sentiment && (
            <p className="text-sm text-white/50 mt-3">Tono general: <span className="text-white/80">{sentimentLabel[ins.sentiment] || ins.sentiment}</span></p>
          )}
        </div>
      )}

      {ins.topics && ins.topics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/80 mb-3">Temas más frecuentes</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {ins.topics.map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-white/90">{t.title}</span>
                  {t.share && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${shareColor[t.share] || shareColor.bajo}`}>{t.share}</span>
                  )}
                </div>
                {t.detail && <p className="text-sm text-white/50">{t.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {ins.unanswered && ins.unanswered.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/80 mb-3">Lo que quizá no supo responder</h3>
          <ul className="space-y-2">
            {ins.unanswered.map((u, i) => (
              <li key={i} className="text-sm text-white/70 flex gap-2">
                <span className="text-amber-400 shrink-0">•</span>{u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ins.suggestions && ins.suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/80 mb-3">Sugerencias para ti</h3>
          <ul className="space-y-2">
            {ins.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-white/70 flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

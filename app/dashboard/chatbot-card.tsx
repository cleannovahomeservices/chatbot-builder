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
  primary_color?: string;
  secondary_color?: string;
  widget_style?: string;
  icon_type?: string;
  system_prompt?: string;
  source_url?: string;
}

const ICON_OPTIONS = [
  { id: 'chat',   label: 'Líneas', d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
  { id: 'dots',   label: 'Puntos', d: 'M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8.5 12c-.83 0-1.5-.67-1.5-1.5S7.67 9 8.5 9 10 9.67 10 10.5 9.33 12 8.5 12zm3.5 0c-.83 0-1.5-.67-1.5-1.5S11.17 9 12 9s1.5.67 1.5 1.5S12.83 12 12 12zm3.5 0c-.83 0-1.5-.67-1.5-1.5S15.17 9 15.5 9 17 9.67 17 10.5 16.33 12 15.5 12z' },
  { id: 'single', label: 'Simple', d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
  { id: 'forum',  label: 'Foro',   d: 'M21 6h-2v9H6v2c0 1.1.9 2 2 2h11l4 4V8c0-1.1-.9-2-2-2zm-4-4H2C.9 2 0 2.9 0 4v15.17L3.17 16H17c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
  { id: 'pair',   label: 'Par',    d: 'M16 17.01V13c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v8l4-4h7c.55 0 1-.45 1-1zm4-14H9c-.55 0-1 .45-1 1v2h7c1.1 0 2 .9 2 2v6h2c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1z' },
] as const;

const WIDGET_STYLES = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'] as const;

export function ChatbotCard({ chatbot: initial }: { chatbot: Chatbot }) {
  const [chatbot, setChatbot] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [editPrimary, setEditPrimary] = useState(chatbot.primary_color || '#7c3aed');
  const [editSecondary, setEditSecondary] = useState(chatbot.secondary_color || '#4338ca');
  const [editStyle, setEditStyle] = useState(chatbot.widget_style || 'bubble');
  const [editIcon, setEditIcon] = useState(chatbot.icon_type || 'chat');
  const [editPrompt, setEditPrompt] = useState(chatbot.system_prompt || '');

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

  function openPanel() {
    setEditPrimary(chatbot.primary_color || '#7c3aed');
    setEditSecondary(chatbot.secondary_color || '#4338ca');
    setEditStyle(chatbot.widget_style || 'bubble');
    setEditIcon(chatbot.icon_type || 'chat');
    setEditPrompt(chatbot.system_prompt || '');
    setSaveError('');
    setPanelOpen(true);
  }

  async function regeneratePrompt() {
    const url = chatbot.source_url;
    if (!url) { setSaveError('Este chatbot no tiene URL guardada. Edita el prompt manualmente.'); return; }
    setRegenerating(true);
    setSaveError('');
    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeData.text) { setSaveError('No se pudo scrapear la web.'); return; }

      // Update colors + style if Claude Vision returned them
      if (scrapeData.primaryColor) setEditPrimary(scrapeData.primaryColor);
      if (scrapeData.secondaryColor) setEditSecondary(scrapeData.secondaryColor);
      if (scrapeData.widgetStyle) setEditStyle(scrapeData.widgetStyle);

      const genRes = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: scrapeData.text }),
      });
      const genData = await genRes.json();
      if (genData.prompt) setEditPrompt(genData.prompt);
      else setSaveError('Error generando el prompt.');
    } catch {
      setSaveError('Error al regenerar. Inténtalo de nuevo.');
    } finally {
      setRegenerating(false);
    }
  }

  async function saveCustomization() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/chatbots/${chatbot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'customize',
          primaryColor: editPrimary,
          secondaryColor: editSecondary,
          widgetStyle: editStyle,
          iconType: editIcon,
          systemPrompt: editPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.chatbot) {
        setChatbot(data.chatbot);
        setPanelOpen(false);
      } else {
        setSaveError(data.error || 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div
                className="w-4 h-4 rounded-full shrink-0 border border-white/10"
                style={{ background: `linear-gradient(135deg, ${chatbot.primary_color || '#7c3aed'}, ${chatbot.secondary_color || '#4338ca'})` }}
              />
              <h2 className="font-semibold text-lg truncate">{chatbot.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${chatbot.status === 'active' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-white/40 bg-white/5'}`}>
                {chatbot.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              {chatbot.widget_injected && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                  Widget inyectado
                </span>
              )}
              {chatbot.widget_style && chatbot.widget_style !== 'bubble' && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/30 bg-white/5">
                  {chatbot.widget_style}
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 mb-3">{chatbot.github_repo}</p>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-xs text-white/30 shrink-0">Webhook:</span>
              <span className="text-xs font-mono text-violet-300 truncate">{chatbot.n8n_webhook_url}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs text-white/25">{new Date(chatbot.created_at).toLocaleDateString('es-ES')}</span>
            <button
              onClick={openPanel}
              disabled={loading || deleting}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:bg-white/5 hover:border-white/30 transition-colors cursor-pointer disabled:opacity-40"
            >
              Personalizar
            </button>
            <button
              onClick={toggleStatus}
              disabled={loading || deleting}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${chatbot.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
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

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">Personalizar chatbot</h3>
                <p className="text-xs text-white/40 mt-0.5">{chatbot.name}</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-white/40 hover:text-white transition text-xl leading-none cursor-pointer">×</button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Color pickers */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-3">Colores del widget</p>
                <div className="flex gap-4 mb-3">
                  <label className="flex-1">
                    <span className="text-xs text-white/50 block mb-1.5">Color principal</span>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <input type="color" value={editPrimary} onChange={(e) => setEditPrimary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                      <span className="text-xs font-mono text-white/70">{editPrimary}</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <span className="text-xs text-white/50 block mb-1.5">Color secundario</span>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <input type="color" value={editSecondary} onChange={(e) => setEditSecondary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                      <span className="text-xs font-mono text-white/70">{editSecondary}</span>
                    </div>
                  </label>
                </div>
                {/* Live preview */}
                <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: '#0d0d0d' }}>
                  <div className="px-4 py-2.5 text-xs font-semibold text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${editPrimary}, ${editSecondary})` }}>
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {chatbot.name}
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <div className="text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2 self-start max-w-[75%]">¡Hola! ¿En qué puedo ayudarte?</div>
                    <div className="text-xs text-white rounded-lg px-3 py-2 self-end max-w-[75%]" style={{ background: `linear-gradient(135deg, ${editPrimary}, ${editSecondary})` }}>Hola, necesito información</div>
                  </div>
                </div>
              </div>

              {/* Icon selector */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Icono del chatbot</p>
                <div className="flex gap-3">
                  {ICON_OPTIONS.map(({ id, label, d }) => (
                    <button
                      key={id}
                      onClick={() => setEditIcon(id)}
                      title={label}
                      className={`relative w-12 h-12 rounded-full transition-all cursor-pointer flex items-center justify-center ${editIcon === id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#111]' : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#111]'}`}
                      style={{ background: '#2a2a2a' }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d={d}/></svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style selector */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Estilo del widget</p>
                <div className="flex flex-wrap gap-1.5">
                  {WIDGET_STYLES.map((st) => (
                    <button
                      key={st}
                      onClick={() => setEditStyle(st)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${editStyle === st ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* System prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white/80">Contenido del chatbot</p>
                  {chatbot.source_url && (
                    <button
                      onClick={regeneratePrompt}
                      disabled={regenerating}
                      className="text-xs px-3 py-1 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition cursor-pointer disabled:opacity-50"
                    >
                      {regenerating ? 'Regenerando…' : '↻ Regenerar desde web'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-white/40 mb-3">Edita las instrucciones que definen cómo responde tu chatbot.</p>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={8}
                  placeholder="Describe cómo debe comportarse tu chatbot…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                />
              </div>

              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setPanelOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={saveCustomization}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Guardando…' : 'Guardar y re-inyectar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

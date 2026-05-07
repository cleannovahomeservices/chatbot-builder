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
  system_prompt?: string;
}

export function ChatbotCard({ chatbot: initial }: { chatbot: Chatbot }) {
  const [chatbot, setChatbot] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Customization state
  const [editPrimary, setEditPrimary] = useState(chatbot.primary_color || '#7c3aed');
  const [editSecondary, setEditSecondary] = useState(chatbot.secondary_color || '#4338ca');
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
    setEditPrompt(chatbot.system_prompt || '');
    setSaveError('');
    setPanelOpen(true);
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
              {/* Color swatch */}
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

      {/* Customization panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
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
                <div className="flex gap-4">
                  <label className="flex-1">
                    <span className="text-xs text-white/50 block mb-1.5">Color principal</span>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <input
                        type="color"
                        value={editPrimary}
                        onChange={(e) => setEditPrimary(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="text-xs font-mono text-white/70">{editPrimary}</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <span className="text-xs text-white/50 block mb-1.5">Color secundario</span>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <input
                        type="color"
                        value={editSecondary}
                        onChange={(e) => setEditSecondary(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="text-xs font-mono text-white/70">{editSecondary}</span>
                    </div>
                  </label>
                </div>
                {/* Live preview */}
                <div className="mt-3 rounded-xl overflow-hidden border border-white/10" style={{ background: '#0d0d0d' }}>
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

              {/* System prompt */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Contenido del chatbot</p>
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

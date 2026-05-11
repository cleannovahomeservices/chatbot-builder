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
  updated_at?: string;
  vercel_project_id?: string;
  primary_color?: string;
  secondary_color?: string;
  widget_style?: string;
  icon_type?: string;
  system_prompt?: string;
  source_url?: string;
  greeting?: string;
  chatbot_language?: string;
}

const ICON_OPTIONS = [
  { id: 'chat',   label: 'Líneas', stroke: false, d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
  { id: 'dots',   label: 'Puntos', stroke: false, d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-4 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
  { id: 'single', label: 'Simple', stroke: true,  d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z' },
  { id: 'forum',  label: 'Foro',   stroke: true,  d: 'M1 1h14v10H5l-4 5V1z M9 11h13v10H20l3 3L20 21H9V11z' },
  { id: 'pair',   label: 'Par',    stroke: false, d: 'M16 4C12 4 9 6.7 9 10c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S20 4 16 4zM8 9C4 9 1 11.7 1 15c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S12 9 8 9z' },
] as const;

const WIDGET_STYLES = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'] as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chatbot-builder-iota.vercel.app';

function buildSnippet(chatbotId: string, name: string, primary: string, secondary: string, style: string, icon: string, greeting: string) {
  const safe = (s: string) => s.replace(/[`"\\]/g, '');
  return `<!-- Chatbot: ${safe(name)} -->\n<script>window.ChatbotConfig={chatbotId:"${chatbotId}",name:"${safe(name)}",primaryColor:"${primary}",secondaryColor:"${secondary}",style:"${style}",icon:"${icon}",greeting:"${safe(greeting)}"};</script>\n<script src="${APP_URL}/widget.js" async defer></script>`;
}

function buildMarkdown(chatbotId: string, name: string, primary: string, secondary: string, style: string, icon: string, greeting: string) {
  const snippet = buildSnippet(chatbotId, name, primary, secondary, style, icon, greeting);
  const host = new URL(APP_URL).hostname;
  return `# Chatbot: ${name}

Eres un asistente de IA. Tu tarea es integrar el siguiente widget de chatbot en este proyecto web. No necesitas hacer nada más que añadir el código de abajo en el lugar indicado.

## Instrucciones de integración

Añade las siguientes líneas de código justo antes del cierre \`</body>\` del archivo HTML principal:

- **Next.js** → en \`app/layout.tsx\` antes de \`{children}\`, o en \`pages/_document.tsx\` dentro de \`<Head>\`
- **Astro / SvelteKit / Nuxt** → en el layout raíz
- **HTML estático** → antes de \`</body>\` en todos los archivos HTML

## Código

\`\`\`html
${snippet}
\`\`\`

## Notas

- El chatbot funciona automáticamente tras la integración. No requiere ninguna configuración adicional.
- Si el proyecto tiene Content Security Policy (CSP): añade \`${host}\` a \`script-src\` y \`connect-src\`.
- Los cambios de contenido son inmediatos y no requieren re-integrar este archivo.
- Para actualizar colores o estilo: descarga un nuevo archivo desde ${APP_URL}/dashboard.
`;
}

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redownloading, setRedownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [reinjectStatus, setReinjectStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [reinjectMessage, setReinjectMessage] = useState('');

  const [editName, setEditName] = useState(chatbot.name);
  const [editGreeting, setEditGreeting] = useState(chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?');
  const [editPrimary, setEditPrimary] = useState(chatbot.primary_color || '#7c3aed');
  const [editSecondary, setEditSecondary] = useState(chatbot.secondary_color || '#4338ca');
  const [editStyle, setEditStyle] = useState(chatbot.widget_style || 'bubble');
  const [editIcon, setEditIcon] = useState(chatbot.icon_type || 'chat');
  const [editPrompt, setEditPrompt] = useState(chatbot.system_prompt || '');

  const router = useRouter();
  const isDownloaded = !chatbot.github_repo;

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
    setEditName(chatbot.name);
    setEditGreeting(chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?');
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

  async function reinjectWidget() {
    setReinjectStatus('loading');
    setReinjectMessage('');
    try {
      const res = await fetch(`/api/chatbots/${chatbot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reinject' }),
      });
      const data = await res.json();
      if (data.ok) {
        setReinjectStatus('ok');
        setReinjectMessage(data.message || 'Widget reconectado');
        setChatbot(prev => ({ ...prev, widget_injected: true }));
      } else {
        setReinjectStatus('error');
        setReinjectMessage(data.message || data.error || 'Error al reconectar');
      }
    } catch {
      setReinjectStatus('error');
      setReinjectMessage('Error de red');
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
          name: editName.trim() || chatbot.name,
          greeting: editGreeting,
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

  function redownloadCard() {
    const md = buildMarkdown(
      chatbot.id, chatbot.name,
      chatbot.primary_color || '#7c3aed',
      chatbot.secondary_color || '#4338ca',
      chatbot.widget_style || 'bubble',
      chatbot.icon_type || 'chat',
      chatbot.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
    );
    const filename = `chatbot-${chatbot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    downloadFile(md, filename);
  }

  function redownloadPanel() {
    setRedownloading(true);
    const name = editName.trim() || chatbot.name;
    const md = buildMarkdown(chatbot.id, name, editPrimary, editSecondary, editStyle, editIcon, editGreeting);
    const filename = `chatbot-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    downloadFile(md, filename);
    setRedownloading(false);
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        {/* Name + badges */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10"
              style={{ background: `linear-gradient(135deg, ${chatbot.primary_color || '#7c3aed'}, ${chatbot.secondary_color || '#4338ca'})` }}
            />
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
            {chatbot.widget_style && chatbot.widget_style !== 'bubble' && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/30 bg-white/5 whitespace-nowrap">
                {chatbot.widget_style}
              </span>
            )}
          </div>
          {/* Timestamp — desktop only */}
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
          {/* Timestamp — mobile only */}
          <span className="sm:hidden text-xs text-white/25">
            {new Date(chatbot.updated_at ?? chatbot.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={openPanel}
              disabled={loading || deleting}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:bg-white/5 hover:border-white/30 transition-colors cursor-pointer disabled:opacity-40"
            >
              Personalizar
            </button>
            {isDownloaded ? (
              <button
                onClick={redownloadCard}
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
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Nombre del chatbot</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej: Asistente de TuEmpresa"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                />
              </div>

              {/* Greeting */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Mensaje de bienvenida</label>
                <input
                  type="text"
                  value={editGreeting}
                  onChange={(e) => setEditGreeting(e.target.value)}
                  placeholder="¡Hola! ¿En qué puedo ayudarte hoy?"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                />
                <p className="text-xs text-white/30 mt-1.5">Este mensaje aparece cuando el visitante abre el chat.</p>
              </div>

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
                    <div className="text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2 self-start max-w-[75%]">{editGreeting || '¡Hola! ¿En qué puedo ayudarte?'}</div>
                    <div className="text-xs text-white rounded-lg px-3 py-2 self-end max-w-[75%]" style={{ background: `linear-gradient(135deg, ${editPrimary}, ${editSecondary})` }}>Hola, necesito información</div>
                  </div>
                </div>
              </div>

              {/* Icon selector */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Icono del chatbot</p>
                <div className="flex gap-3">
                  {ICON_OPTIONS.map(({ id, label, d, stroke }) => (
                    <button
                      key={id}
                      onClick={() => setEditIcon(id)}
                      title={label}
                      className={`relative w-12 h-12 rounded-full transition-all cursor-pointer flex items-center justify-center ${editIcon === id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#111]' : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#111]'}`}
                      style={{ background: '#2a2a2a' }}
                    >
                      {stroke
                        ? <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                        : <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d={d}/></svg>
                      }
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

              {/* Reinject status (GitHub chatbots only) */}
              {!isDownloaded && reinjectStatus !== 'idle' && (
                <p className={`text-sm ${reinjectStatus === 'ok' ? 'text-emerald-400' : reinjectStatus === 'error' ? 'text-red-400' : 'text-white/40'}`}>
                  {reinjectStatus === 'loading' ? 'Reconectando widget…' : reinjectMessage}
                </p>
              )}

              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            </div>

            {/* Panel footer — different for downloaded vs GitHub */}
            {isDownloaded ? (
              <div className="px-4 sm:px-6 py-4 border-t border-white/10 space-y-2">
                <div className="flex gap-3">
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
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                <button
                  onClick={redownloadPanel}
                  disabled={redownloading}
                  className="w-full py-2.5 rounded-xl border border-violet-500/40 text-sm font-semibold text-violet-300 hover:bg-violet-500/10 transition disabled:opacity-50 cursor-pointer"
                >
                  {redownloading ? 'Descargando…' : 'Re-descargar .md'}
                </button>
              </div>
            ) : (
              <div className="px-6 py-4 border-t border-white/10 space-y-3">
                <div className="flex gap-3">
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
                <button
                  onClick={reinjectWidget}
                  disabled={reinjectStatus === 'loading'}
                  className="w-full py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition cursor-pointer disabled:opacity-40"
                >
                  {reinjectStatus === 'loading' ? 'Reconectando…' : 'Forzar re-inyección del widget'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

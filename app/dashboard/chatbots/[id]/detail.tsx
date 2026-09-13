"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Chatbot } from '@/lib/types';
import type { PlanName } from '@/lib/plans';
import { InlineChat } from '@/components/inline-chat';
import { ConversationsPanel } from './conversations-panel';
import { InsightsPanel } from './insights-panel';
import { buildSnippet, buildIframeSnippet, buildMarkdown, type WidgetSnippetConfig } from '@/lib/widget-snippet';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chatbot-builder-iota.vercel.app';

const ICON_OPTIONS = [
  { id: 'chat',   label: 'Líneas', stroke: false, d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
  { id: 'dots',   label: 'Puntos', stroke: false, d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-4 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
  { id: 'single', label: 'Simple', stroke: true,  d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z' },
  { id: 'forum',  label: 'Foro',   stroke: true,  d: 'M1 1h14v10H5l-4 5V1z M9 11h13v10H20l3 3L20 21H9V11z' },
  { id: 'pair',   label: 'Par',    stroke: false, d: 'M16 4C12 4 9 6.7 9 10c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S20 4 16 4zM8 9C4 9 1 11.7 1 15c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S12 9 8 9z' },
] as const;

const WIDGET_STYLES = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'] as const;

type Tab = 'probar' | 'conversaciones' | 'analisis' | 'apariencia' | 'instalar' | 'contacto' | 'marca';

const TABS: { id: Tab; label: string }[] = [
  { id: 'probar',         label: 'Probador' },
  { id: 'conversaciones', label: 'Conversaciones' },
  { id: 'analisis',       label: 'Qué quiere tu gente' },
  { id: 'apariencia',     label: 'Apariencia' },
  { id: 'contacto',       label: 'Contacto y cita' },
  { id: 'instalar',       label: 'Instalar' },
  { id: 'marca',          label: 'Marca' },
];

export function ChatbotDetail({ chatbot: initial, plan }: { chatbot: Chatbot; plan: PlanName }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('probar');

  // --- Estado editable ---
  const [name, setName] = useState(initial.name);
  const [greeting, setGreeting] = useState(initial.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?');
  const [primary, setPrimary] = useState(initial.primary_color || '#7c3aed');
  const [secondary, setSecondary] = useState(initial.secondary_color || '#4338ca');
  const [style, setStyle] = useState(initial.widget_style || 'bubble');
  const [icon, setIcon] = useState(initial.icon_type || 'chat');
  const [prompt, setPrompt] = useState(initial.system_prompt || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url ?? null);
  const [whatsapp, setWhatsapp] = useState(initial.handoff_whatsapp ?? '');
  const [email, setEmail] = useState(initial.handoff_email ?? '');
  const [booking, setBooking] = useState(initial.booking_url ?? '');
  const [hideBranding, setHideBranding] = useState(!!initial.hide_branding);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [flash, setFlash] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [embedType, setEmbedType] = useState<'script' | 'iframe'>('script');
  const [copied, setCopied] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [reinjectMsg, setReinjectMsg] = useState('');
  const [reinjecting, setReinjecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isFree = plan === 'free';
  const isDownloaded = !initial.github_repo;

  const cfg: WidgetSnippetConfig = {
    chatbotId: initial.id,
    name,
    primaryColor: primary,
    secondaryColor: secondary,
    style,
    icon,
    greeting,
    avatarUrl,
    hideBranding,
    handoffWhatsapp: whatsapp || null,
    handoffEmail: email || null,
    bookingUrl: booking || null,
  };

  async function save() {
    setSaving(true);
    setSaveError('');
    setFlash('');
    try {
      const res = await fetch(`/api/chatbots/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'customize',
          name: name.trim() || initial.name,
          greeting,
          primaryColor: primary,
          secondaryColor: secondary,
          widgetStyle: style,
          iconType: icon,
          systemPrompt: prompt || undefined,
          handoffWhatsapp: whatsapp,
          handoffEmail: email,
          bookingUrl: booking,
          hideBranding,
        }),
      });
      const data = await res.json();
      if (data.chatbot) {
        // Refleja lo que el backend guardó (p. ej. hideBranding forzado a false en plan free)
        setHideBranding(!!data.chatbot.hide_branding);
        setFlash('Guardado ✓ — se aplica solo en tu web');
        setTimeout(() => setFlash(''), 3000);
        router.refresh();
      } else {
        setSaveError(data.error || 'Error al guardar');
      }
    } catch {
      setSaveError('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setSaveError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/chatbots/${initial.id}/avatar`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        router.refresh();
      } else {
        setSaveError(data.error || 'Error al subir la imagen');
      }
    } catch {
      setSaveError('Error de red al subir la imagen');
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await fetch(`/api/chatbots/${initial.id}/avatar`, { method: 'DELETE' });
      setAvatarUrl(null);
      router.refresh();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function regeneratePrompt() {
    if (!initial.source_url) { setSaveError('Este chatbot no tiene URL guardada. Edita el contenido manualmente.'); return; }
    setRegenerating(true);
    setSaveError('');
    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: initial.source_url }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeData.text) { setSaveError('No se pudo scrapear la web.'); return; }
      if (scrapeData.primaryColor) setPrimary(scrapeData.primaryColor);
      if (scrapeData.secondaryColor) setSecondary(scrapeData.secondaryColor);
      if (scrapeData.widgetStyle) setStyle(scrapeData.widgetStyle);
      // Autorrellena contacto solo si está vacío (no pisa lo que el usuario ya puso)
      const c = scrapeData.contact;
      if (c) {
        if (c.whatsapp && !whatsapp.trim()) setWhatsapp(c.whatsapp);
        if (c.email && !email.trim()) setEmail(c.email);
      }
      const genRes = await fetch('/api/generate-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: scrapeData.text }),
      });
      const genData = await genRes.json();
      if (genData.prompt) setPrompt(genData.prompt);
      else setSaveError('Error generando el contenido.');
    } catch {
      setSaveError('Error al regenerar. Inténtalo de nuevo.');
    } finally {
      setRegenerating(false);
    }
  }

  async function reinject() {
    setReinjecting(true);
    setReinjectMsg('');
    try {
      const res = await fetch(`/api/chatbots/${initial.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reinject' }),
      });
      const data = await res.json();
      setReinjectMsg(data.ok ? (data.message || 'Widget reconectado') : (data.message || data.error || 'Error al reconectar'));
    } catch {
      setReinjectMsg('Error de red');
    } finally {
      setReinjecting(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  function downloadMd() {
    const md = buildMarkdown(cfg, APP_URL);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const snippet = embedType === 'script' ? buildSnippet(cfg, APP_URL) : buildIframeSnippet(cfg, APP_URL);

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30";
  const previewNode = (
    <div className="rounded-2xl overflow-hidden border border-white/10 h-[560px]">
      <InlineChat
        chatbotId={initial.id}
        name={name || 'Asistente'}
        greeting={greeting}
        primaryColor={primary}
        secondaryColor={secondary}
        avatarUrl={avatarUrl}
        handoffWhatsapp={whatsapp || null}
        handoffEmail={email || null}
        bookingUrl={booking || null}
      />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Cabecera */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-sm text-white/50 hover:text-white transition shrink-0">← Volver</Link>
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
          ) : (
            <span className="w-4 h-4 rounded-full shrink-0 border border-white/10" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
          )}
          <h1 className="text-lg sm:text-xl font-semibold truncate">{name}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {flash && <span className="text-sm text-emerald-400">{flash}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {saveError && <p className="mb-4 text-sm text-red-400">{saveError}</p>}

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap mb-6 border-b border-white/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              tab === t.id ? 'bg-violet-600 text-white' : 'text-white/55 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- PROBADOR --- */}
      {tab === 'probar' && (
        <div className="max-w-md mx-auto">
          <p className="text-sm text-white/50 mb-4 text-center">
            Habla con tu chatbot como lo haría un visitante. Usa el contenido guardado.
          </p>
          {previewNode}
        </div>
      )}

      {/* --- CONVERSACIONES --- */}
      {tab === 'conversaciones' && <ConversationsPanel chatbotId={initial.id} />}

      {/* --- QUÉ QUIERE TU GENTE --- */}
      {tab === 'analisis' && <InsightsPanel chatbotId={initial.id} />}

      {/* --- APARIENCIA (split: ajustes | preview en vivo) --- */}
      {tab === 'apariencia' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Nombre del chatbot</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej: Asistente de TuEmpresa" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Mensaje de bienvenida</label>
              <input value={greeting} onChange={(e) => setGreeting(e.target.value)} className={inputCls} placeholder="¡Hola! ¿En qué puedo ayudarte hoy?" />
            </div>

            {/* Avatar / logo */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Foto o logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 flex items-center justify-center shrink-0" style={{ background: avatarUrl ? '#000' : `linear-gradient(135deg, ${primary}, ${secondary})` }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-white/70 text-xl font-bold">{(name[0] || 'A').toUpperCase()}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                  <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:bg-white/5 transition cursor-pointer disabled:opacity-50">
                    {avatarBusy ? 'Subiendo…' : avatarUrl ? 'Cambiar imagen' : 'Subir imagen'}
                  </button>
                  {avatarUrl && (
                    <button onClick={removeAvatar} disabled={avatarBusy}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/30 transition cursor-pointer disabled:opacity-50">
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-white/30 mt-2">PNG, JPG, WEBP, GIF o SVG. Máx. 2 MB. Se aplica al instante.</p>
            </div>

            {/* Colores */}
            <div>
              <p className="text-sm font-medium text-white/80 mb-3">Colores del widget</p>
              <div className="flex gap-4">
                <label className="flex-1">
                  <span className="text-xs text-white/50 block mb-1.5">Principal</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className="text-xs font-mono text-white/70">{primary}</span>
                  </div>
                </label>
                <label className="flex-1">
                  <span className="text-xs text-white/50 block mb-1.5">Secundario</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className="text-xs font-mono text-white/70">{secondary}</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Icono */}
            <div>
              <p className="text-sm font-medium text-white/80 mb-2">Icono (cuando no hay foto)</p>
              <div className="flex gap-3">
                {ICON_OPTIONS.map(({ id, label, d, stroke }) => (
                  <button key={id} onClick={() => setIcon(id)} title={label}
                    className={`w-12 h-12 rounded-full transition-all cursor-pointer flex items-center justify-center ${icon === id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0a0a0a]' : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#0a0a0a]'}`}
                    style={{ background: '#2a2a2a' }}>
                    {stroke
                      ? <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                      : <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d={d} /></svg>}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilo */}
            <div>
              <p className="text-sm font-medium text-white/80 mb-2">Estilo del widget</p>
              <div className="flex flex-wrap gap-1.5">
                {WIDGET_STYLES.map((st) => (
                  <button key={st} onClick={() => setStyle(st)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer border ${style === st ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white/80">Contenido del chatbot</p>
                {initial.source_url && (
                  <button onClick={regeneratePrompt} disabled={regenerating}
                    className="text-xs px-3 py-1 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition cursor-pointer disabled:opacity-50">
                    {regenerating ? 'Regenerando…' : '↻ Regenerar desde web'}
                  </button>
                )}
              </div>
              <p className="text-xs text-white/40 mb-3">Las instrucciones que definen cómo responde. Guarda para que el Probador las use.</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8}
                placeholder="Describe cómo debe comportarse tu chatbot…"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30" />
            </div>
          </div>

          {/* Preview en vivo */}
          <div className="lg:sticky lg:top-6 self-start w-full">
            <p className="text-xs text-white/40 mb-2">Vista previa en vivo</p>
            {previewNode}
          </div>
        </div>
      )}

      {/* --- CONTACTO Y CITA --- */}
      {tab === 'contacto' && (
        <div className="max-w-xl space-y-6">
          <p className="text-sm text-white/50">
            Añade formas de que el visitante contacte contigo o reserve. Aparecen como botones dentro del chat.
          </p>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">WhatsApp del negocio</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="+34 600 123 456" />
            <p className="text-xs text-white/30 mt-1.5">Con prefijo internacional. Abre wa.me directamente, sin configurar ninguna API.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Email del negocio</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="hola@tunegocio.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Enlace para pedir cita</label>
            <input value={booking} onChange={(e) => setBooking(e.target.value)} className={inputCls} placeholder="https://cal.com/tunegocio/30min" />
            <p className="text-xs text-white/30 mt-1.5">
              Pega tu enlace de <b>Cal.com</b> o Calendly. Cal.com es gratis y se conecta con tu Google Calendar:
              crea tu cuenta, conecta el calendario y copia aquí el enlace de tu tipo de cita.
            </p>
          </div>
          <div className="pt-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-50 cursor-pointer">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* --- INSTALAR --- */}
      {tab === 'instalar' && (
        <div className="max-w-2xl space-y-5">
          <div className="flex gap-1.5">
            <button onClick={() => setEmbedType('script')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${embedType === 'script' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
              Script (recomendado)
            </button>
            <button onClick={() => setEmbedType('iframe')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${embedType === 'iframe' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
              iframe
            </button>
          </div>

          <p className="text-sm text-white/50">
            {embedType === 'script'
              ? 'Pega este código antes de </body>. Muestra la burbuja flotante en la esquina.'
              : 'Chat embebido dentro de la página (para Wix, Squarespace o donde solo se permita un bloque HTML). Colócalo donde quieras.'}
          </p>

          <div className="relative">
            <pre className="rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-white/80 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
            <button onClick={() => copy(snippet, 'snippet')}
              className="absolute top-2 right-2 text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition cursor-pointer">
              {copied === 'snippet' ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>

          {embedType === 'script' && (
            <div className="flex flex-wrap gap-3">
              <button onClick={downloadMd}
                className="text-sm px-4 py-2 rounded-xl border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 transition cursor-pointer">
                Descargar .md (para pasar a la IA de tu web)
              </button>
              <a href={`${APP_URL}/embed/${initial.id}`} target="_blank" rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition">
                Abrir chat en una pestaña
              </a>
            </div>
          )}

          <p className="text-xs text-white/30">
            El widget lee la configuración <b>en vivo</b>: al <b>guardar</b>, los cambios (colores, avatar, saludo,
            contacto, marca) se aplican solos en la web donde ya esté instalado, <b>sin re-inyectar ni volver a subir el código</b>.
          </p>

          {!isDownloaded && (
            <div className="pt-4 border-t border-white/10">
              <p className="text-sm font-medium text-white/80 mb-1">Repositorio conectado</p>
              <p className="text-xs text-white/40 mb-3 break-all">{initial.github_repo}</p>
              <button onClick={reinject} disabled={reinjecting}
                className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition cursor-pointer disabled:opacity-50">
                {reinjecting ? 'Reconectando…' : 'Forzar re-inyección del widget'}
              </button>
              {reinjectMsg && <p className="text-xs text-white/50 mt-2">{reinjectMsg}</p>}
            </div>
          )}
        </div>
      )}

      {/* --- MARCA --- */}
      {tab === 'marca' && (
        <div className="max-w-xl space-y-5">
          <p className="text-sm text-white/50">
            Por defecto el chat muestra un discreto <b>“Con tecnología de BotLuma”</b> en el pie.
          </p>
          <label className={`flex items-start gap-3 rounded-xl border p-4 ${isFree ? 'border-white/10 opacity-60' : 'border-white/15 cursor-pointer hover:border-white/25'}`}>
            <input type="checkbox" checked={hideBranding} disabled={isFree}
              onChange={(e) => setHideBranding(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer disabled:cursor-not-allowed" />
            <span>
              <span className="block text-sm font-medium text-white/90">Ocultar “Con tecnología de BotLuma”</span>
              <span className="block text-xs text-white/40 mt-1">
                {isFree
                  ? 'Disponible a partir del plan Starter (5 €/mes). Mejora tu plan para quitar la marca.'
                  : 'El pie desaparece del widget en cuanto guardes.'}
              </span>
            </span>
          </label>
          {isFree && (
            <Link href="/dashboard?upgrade=1" className="inline-block text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition">
              Ver planes
            </Link>
          )}
          {!isFree && (
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-50 cursor-pointer">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "input" | "generating" | "review" | "deploy" | "repo" | "creating" | "done";
const STEP_DOTS: Step[] = ["input", "generating", "review", "deploy", "creating", "done"];

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chatbot-builder-iota.vercel.app';

function buildSnippet(chatbotId: string, name: string, primary: string, secondary: string, style: string, icon: string, greeting: string) {
  const safe = (s: string) => s.replace(/[`"\\]/g, '');
  return `<!-- Chatbot: ${safe(name)} -->\n<script>window.ChatbotConfig={chatbotId:"${chatbotId}",name:"${safe(name)}",primaryColor:"${primary}",secondaryColor:"${secondary}",style:"${style}",icon:"${icon}",greeting:"${safe(greeting)}"};</script>\n<script src="${APP_URL}/widget.js" async defer></script>`;
}

function buildMarkdown(chatbotId: string, name: string, primary: string, secondary: string, style: string, icon: string, greeting: string) {
  const snippet = buildSnippet(chatbotId, name, primary, secondary, style, icon, greeting);
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
- Si el proyecto tiene Content Security Policy (CSP): añade \`${new URL(APP_URL).hostname}\` a \`script-src\` y \`connect-src\`.
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

export function CreateWizard({
  initialMode,
  initialInput,
}: {
  initialMode: string;
  initialInput: string;
  initialVercel?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialInput.trim() ? "generating" : "input");
  const [userInput, setUserInput] = useState(initialInput);
  const [inputMode, setInputMode] = useState<"describe" | "url">(initialMode === "url" ? "url" : "describe");
  const [prompt, setPrompt] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [chatbotName, setChatbotName] = useState("");
  const [error, setError] = useState("");
  const [createdChatbot, setCreatedChatbot] = useState<{
    id: string;
    widget_injected: boolean;
  } | null>(null);
  const [injectFile, setInjectFile] = useState<string | undefined>();
  const [injectReason, setInjectReason] = useState<string | undefined>();
  const [injectPrUrl, setInjectPrUrl] = useState<string | undefined>();
  const [extractedColors, setExtractedColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [widgetPrimary, setWidgetPrimary] = useState('#7c3aed');
  const [widgetSecondary, setWidgetSecondary] = useState('#4338ca');
  const [widgetStyle, setWidgetStyle] = useState('bubble');
  const [iconType, setIconType] = useState('chat');
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [wizardGreeting, setWizardGreeting] = useState('¡Hola! ¿En qué puedo ayudarte hoy?');
  const [deployMethod, setDeployMethod] = useState<'github' | 'download' | null>(null);

  async function startGenerating() {
    if (!userInput.trim()) return;
    setStep("generating");
    try {
      let input = userInput;
      let lang = 'es';
      if (inputMode === "url" && userInput) {
        const r = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: userInput }),
        });
        const d = await r.json();
        if (d.text) input = d.text;
        if (d.primaryColor && d.secondaryColor) {
          setExtractedColors({ primary: d.primaryColor, secondary: d.secondaryColor });
          setWidgetPrimary(d.primaryColor);
          setWidgetSecondary(d.secondaryColor);
        }
        if (d.widgetStyle) setWidgetStyle(d.widgetStyle);
        if (d.detectedLanguage) {
          lang = d.detectedLanguage;
          setWizardGreeting(lang === 'en' ? 'Hi! How can I help you today?' : '¡Hola! ¿En qué puedo ayudarte hoy?');
        }
        setSourceUrl(userInput);
      }
      const r = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const d = await r.json();
      if (d.prompt) { setPrompt(d.prompt); setStep("review"); }
      else setStep("input");
    } catch {
      setStep("input");
    }
  }

  // Restore wizard state after GitHub OAuth redirect
  useEffect(() => {
    const saved = sessionStorage.getItem('wizard_resume');
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      sessionStorage.removeItem('wizard_resume');
      if (s.prompt) setPrompt(s.prompt);
      if (s.userInput) setUserInput(s.userInput);
      if (s.inputMode) setInputMode(s.inputMode);
      if (s.chatbotName) setChatbotName(s.chatbotName);
      setDeployMethod('github');
      setStep('repo');
      setError('');
      fetch('/api/github/repos').then(async (r) => {
        if (r.status === 400) { setGithubConnected(false); return; }
        const d = await r.json();
        setGithubConnected(true);
        setRepos(d.repos ?? []);
      }).catch(() => {});
    } catch {}
  }, []);

  // Generate prompt on mount only if initialInput was provided
  useEffect(() => {
    if (!initialInput.trim()) return;
    if (sessionStorage.getItem('wizard_resume')) return;
    async function generate() {
      try {
        let input = initialInput;
        let lang = 'es';
        if (initialMode === "url" && initialInput) {
          const r = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: initialInput }),
          });
          const d = await r.json();
          if (d.text) input = d.text;
          if (d.primaryColor && d.secondaryColor) {
            setExtractedColors({ primary: d.primaryColor, secondary: d.secondaryColor });
            setWidgetPrimary(d.primaryColor);
            setWidgetSecondary(d.secondaryColor);
          }
          if (d.widgetStyle) setWidgetStyle(d.widgetStyle);
          if (d.detectedLanguage) {
            lang = d.detectedLanguage;
            setWizardGreeting(lang === 'en' ? 'Hi! How can I help you today?' : '¡Hola! ¿En qué puedo ayudarte hoy?');
          }
          setSourceUrl(initialInput);
        }
        const r = await fetch("/api/generate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const d = await r.json();
        if (d.prompt) { setPrompt(d.prompt); setStep("review"); }
        else setError("No se pudo generar el prompt.");
      } catch {
        setError("Error de conexión.");
      }
    }
    generate();
  }, []);

  useEffect(() => {
    if (step !== 'deploy') return;
    fetch('/api/github/repos').then(async r => {
      if (r.ok) { const d = await r.json(); setGithubConnected(true); setRepos(d.repos ?? []); }
      else { setGithubConnected(false); }
    }).catch(() => setGithubConnected(false));
  }, [step]);

  async function loadRepos() {
    setDeployMethod('github');
    setStep("repo");
    setError("");
    if (githubConnected === true && repos.length > 0) return;
    try {
      const r = await fetch("/api/github/repos");
      if (r.status === 400) { setGithubConnected(false); return; }
      const d = await r.json();
      setGithubConnected(true);
      setRepos(d.repos ?? []);
    } catch {
      setError("No se pudieron cargar los repositorios.");
    }
  }

  async function createChatbot() {
    if (!selectedRepo || !chatbotName.trim()) return;
    setStep("creating");
    try {
      const colors = { primaryColor: widgetPrimary, secondaryColor: widgetSecondary, widgetStyle, iconType };
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chatbotName, systemPrompt: prompt, githubRepo: selectedRepo, sourceUrl, greeting: wizardGreeting, ...colors }),
      });
      const data = await res.json();
      if (data.chatbot) {
        setCreatedChatbot(data.chatbot);
        setInjectFile(data.injectFile);
        setInjectReason(data.injectReason);
        setInjectPrUrl(data.injectPrUrl);
        setStep("done");
      } else {
        setError(data.error ?? "Error desconocido al crear el chatbot.");
        setStep("repo");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
      setStep("repo");
    }
  }

  async function downloadChatbot() {
    if (!chatbotName.trim()) return;
    setDeployMethod('download');
    setStep("creating");
    try {
      const colors = { primaryColor: widgetPrimary, secondaryColor: widgetSecondary, widgetStyle, iconType };
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chatbotName, systemPrompt: prompt, githubRepo: null, sourceUrl, greeting: wizardGreeting, ...colors }),
      });
      const data = await res.json();
      if (data.chatbot) {
        const md = buildMarkdown(data.chatbot.id, chatbotName, widgetPrimary, widgetSecondary, widgetStyle, iconType, wizardGreeting);
        const filename = `chatbot-${chatbotName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        downloadFile(md, filename);
        router.push("/dashboard");
      } else {
        setError(data.error ?? "Error desconocido al crear el chatbot.");
        setStep("deploy");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
      setStep("deploy");
    }
  }

  const canCreate = chatbotName.trim() && !!selectedRepo;
  const canDeploy = !!chatbotName.trim();

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Step dots */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {STEP_DOTS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-all ${step === s ? "bg-violet-400 scale-125" : i < STEP_DOTS.indexOf(step) ? "bg-violet-700" : "bg-white/20"}`} />
              {i < STEP_DOTS.length - 1 && <div className="h-px w-6 bg-white/10" />}
            </div>
          ))}
        </div>

        {/* STEP: Input */}
        {step === "input" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Crea tu chatbot</h2>
            <p className="text-white/50 mb-6">Describe tu negocio o pega la URL de tu web.</p>
            <div className="flex rounded-xl bg-white/5 p-1 mb-5">
              <button onClick={() => setInputMode("describe")} className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all cursor-pointer ${inputMode === "describe" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}>
                Describe tu negocio
              </button>
              <button onClick={() => setInputMode("url")} className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all cursor-pointer ${inputMode === "url" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}>
                URL de tu web
              </button>
            </div>
            {inputMode === "describe" ? (
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={6}
                placeholder="Ej: Somos una clínica dental en Madrid. Ofrecemos implantes, ortodoncia y blanqueamiento..."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
              />
            ) : (
              <input
                type="url"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="https://tuempresa.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
              />
            )}
            <button
              onClick={startGenerating}
              disabled={!userInput.trim()}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Generar chatbot con IA →
            </button>
          </div>
        )}

        {/* STEP: Generating */}
        {step === "generating" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 mb-6">
              <div className="h-6 w-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Analizando tu negocio</h2>
            <p className="text-white/50">Claude está generando el system prompt perfecto para ti…</p>
          </div>
        )}

        {/* STEP: Review prompt */}
        {step === "review" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Tu chatbot está listo</h2>
            <p className="text-white/50 mb-6">Revisa el prompt y los colores antes de continuar.</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
            />

            {/* Color pickers */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white/80">Colores del widget</p>
                {extractedColors && (
                  <span className="text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">
                    Detectados de tu web
                  </span>
                )}
              </div>
              <div className="flex gap-4 mb-4">
                <label className="flex-1">
                  <span className="text-xs text-white/50 block mb-1.5">Color principal</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <input type="color" value={widgetPrimary} onChange={(e) => setWidgetPrimary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className="text-xs font-mono text-white/70">{widgetPrimary}</span>
                  </div>
                </label>
                <label className="flex-1">
                  <span className="text-xs text-white/50 block mb-1.5">Color secundario</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <input type="color" value={widgetSecondary} onChange={(e) => setWidgetSecondary(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className="text-xs font-mono text-white/70">{widgetSecondary}</span>
                  </div>
                </label>
              </div>

              {/* Icon selector */}
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2">Icono del chatbot</p>
                <div className="flex gap-3">
                  {([
                    { id: 'chat',   label: 'Líneas', stroke: false, d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
                    { id: 'dots',   label: 'Puntos', stroke: false, d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-4 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
                    { id: 'single', label: 'Simple', stroke: true,  d: 'M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z' },
                    { id: 'forum',  label: 'Foro',   stroke: true,  d: 'M1 1h14v10H5l-4 5V1z M9 11h13v10H20l3 3L20 21H9V11z' },
                    { id: 'pair',   label: 'Par',    stroke: false, d: 'M16 4C12 4 9 6.7 9 10c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S20 4 16 4zM8 9C4 9 1 11.7 1 15c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S12 9 8 9z' },
                  ] as const).map(({ id, label, d, stroke }) => (
                    <button key={id} onClick={() => setIconType(id)} title={label}
                      className={`relative w-12 h-12 rounded-full transition-all cursor-pointer flex items-center justify-center ${iconType === id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0A0A0A]' : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#0A0A0A]'}`}
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
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/50">Estilo del widget</p>
                  {extractedColors && <span className="text-xs text-violet-400">Elegido por IA</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'] as const).map((st) => (
                    <button key={st} onClick={() => setWidgetStyle(st)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${widgetStyle === st ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}
                    >{st}</button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: '#0d0d0d' }}>
                <div className="px-4 py-2.5 text-xs font-semibold text-white flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${widgetPrimary}, ${widgetSecondary})` }}>
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Asistente virtual
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div className="text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2 self-start max-w-[75%]">¡Hola! ¿En qué puedo ayudarte?</div>
                  <div className="text-xs text-white rounded-lg px-3 py-2 self-end max-w-[75%]" style={{ background: `linear-gradient(135deg, ${widgetPrimary}, ${widgetSecondary})` }}>Hola, necesito información</div>
                </div>
              </div>
            </div>

            <button onClick={() => setStep("deploy")}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] cursor-pointer"
            >
              Continuar → Instalar en tu web
            </button>
          </div>
        )}

        {/* STEP: Deploy method */}
        {step === "deploy" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">¿Cómo quieres instalarlo?</h2>
            <p className="text-white/50 mb-6">Tu chatbot está listo. Elige cómo integrarlo en tu web.</p>

            {/* Chatbot name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/70 mb-2">Nombre del chatbot</label>
              <input
                type="text"
                value={chatbotName}
                onChange={(e) => setChatbotName(e.target.value)}
                placeholder="Ej: Asistente de TuEmpresa"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
              />
            </div>

            <div className="flex flex-col gap-3">
              {/* GitHub option */}
              <button
                onClick={loadRepos}
                disabled={!canDeploy}
                className="group w-full rounded-xl border border-white/10 bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/5 p-5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 group-hover:bg-violet-500/10 transition-colors">
                    <svg className="h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      {githubConnected === true ? 'GitHub conectado ✓' : 'Conectar con GitHub'}
                    </p>
                    <p className="text-sm text-white/40 mt-0.5">
                      {githubConnected === true
                        ? `${repos.length} repositorio${repos.length !== 1 ? 's' : ''} disponible${repos.length !== 1 ? 's' : ''}`
                        : githubConnected === null
                        ? 'Verificando conexión…'
                        : 'Inyectamos el widget automáticamente en tu repositorio.'}
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Download option */}
              <button
                onClick={downloadChatbot}
                disabled={!canDeploy}
                className="group w-full rounded-xl border border-violet-500/30 bg-violet-500/5 hover:border-violet-500/60 hover:bg-violet-500/10 p-5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                    <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">Descargar chatbot</p>
                    <p className="text-sm text-white/40 mt-0.5">Descarga un archivo e implémentalo con tu IA favorita en menos de 2 minutos.</p>
                    <p className="text-xs text-violet-400/70 mt-1">Compatible con Cursor, Replit, Lovable, Claude Code…</p>
                  </div>
                  <svg className="h-4 w-4 text-violet-400/50 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>
        )}

        {/* STEP: Select repo (GitHub only) */}
        {step === "repo" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Selecciona tu repositorio</h2>
            <p className="text-white/50 mb-5">Inyectaremos el widget automáticamente en tu código.</p>

            {githubConnected === false ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <svg className="h-8 w-8 mx-auto mb-3 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <p className="text-white/50 text-sm mb-4">Conecta tu cuenta de GitHub para ver tus repositorios</p>
                <button
                  onClick={() => {
                    sessionStorage.setItem('wizard_resume', JSON.stringify({ prompt, userInput, inputMode, chatbotName }));
                    window.location.href = '/api/auth/github?next=/create';
                  }}
                  className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition cursor-pointer"
                >
                  Conectar GitHub →
                </button>
              </div>
            ) : githubConnected === null ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/40 text-sm">
                Cargando repositorios…
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-3 pt-3 pb-2 border-b border-white/5">
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Buscar repositorio…"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {repos.filter(r => r.full_name.toLowerCase().includes(repoSearch.toLowerCase())).length === 0 ? (
                    <div className="p-6 text-center text-white/40 text-sm">
                      {repos.length === 0 ? 'No se encontraron repositorios' : 'Sin resultados para esa búsqueda'}
                    </div>
                  ) : (
                    repos
                      .filter(r => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                      .map((r) => (
                        <button
                          key={r.full_name}
                          onClick={() => setSelectedRepo(r.full_name)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition border-b border-white/5 last:border-0 cursor-pointer ${selectedRepo === r.full_name ? "bg-violet-500/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                        >
                          <span>{r.full_name}</span>
                          {r.private && <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5">privado</span>}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              onClick={createChatbot}
              disabled={!canCreate}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Crear e inyectar chatbot →
            </button>
          </div>
        )}

        {/* STEP: Creating */}
        {step === "creating" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 mb-6">
              <div className="h-6 w-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {deployMethod === 'download' ? 'Creando tu chatbot…' : 'Inyectando el widget…'}
            </h2>
            <p className="text-white/50">
              {deployMethod === 'download' ? 'Preparando el archivo de integración…' : 'Configurando e inyectando el widget en tu repositorio…'}
            </p>
          </div>
        )}

        {/* STEP: Done (GitHub path) */}
        {step === "done" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 mb-6 text-2xl">✓</div>
            <h2 className="text-2xl font-bold mb-2">¡Chatbot creado!</h2>

            {createdChatbot?.widget_injected && (
              <p className="text-white/50 mb-6">
                Widget inyectado en{" "}
                <code className="bg-white/10 px-1 rounded text-xs">{injectFile}</code>.
                Tu chatbot está activo.
              </p>
            )}

            {!createdChatbot?.widget_injected && injectPrUrl && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 text-left mb-6">
                <p className="text-sm font-semibold text-violet-300 mb-1">Un paso más: acepta el PR en GitHub</p>
                <p className="text-xs text-white/50 mb-4">
                  Tu rama principal está protegida. Hemos creado una Pull Request automáticamente — solo tienes que abrirla y pulsar &ldquo;Merge pull request&rdquo;.
                </p>
                <a href={injectPrUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-block w-full text-center rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition"
                >
                  Ver Pull Request en GitHub →
                </a>
              </div>
            )}

            {!createdChatbot?.widget_injected && !injectPrUrl && injectReason && (
              <p className="text-xs text-white/30 mb-6">Motivo: {injectReason}</p>
            )}

            <button onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition cursor-pointer"
            >
              Ver mis chatbots →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

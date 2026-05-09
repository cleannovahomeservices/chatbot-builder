"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "input" | "generating" | "review" | "repo" | "creating" | "done";
type DeployMethod = "github" | "vercel";

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
}

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  link?: { type: string; repo: string; org: string };
}

export function CreateWizard({
  initialMode,
  initialInput,
  initialVercel,
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
  const [deployMethod, setDeployMethod] = useState<DeployMethod>(
    initialVercel ? "vercel" : "github"
  );
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([]);
  const [vercelConnected, setVercelConnected] = useState(false);
  const [vercelSearch, setVercelSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedVercelProject, setSelectedVercelProject] = useState<VercelProject | null>(null);
  const [chatbotName, setChatbotName] = useState("");
  const [error, setError] = useState("");
  const [createdChatbot, setCreatedChatbot] = useState<{
    n8n_webhook_url: string;
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

  async function startGenerating() {
    if (!userInput.trim()) return;
    setStep("generating");
    try {
      let input = userInput;
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

  // Restore wizard state after GitHub or Vercel OAuth redirect
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
      setStep('repo');
      setError('');
      if (s.deployMethod === 'vercel') {
        setDeployMethod('vercel');
        fetch('/api/vercel/projects').then(async (r) => {
          const d = await r.json();
          if (!d.error) { setVercelConnected(true); setVercelProjects(d.projects ?? []); }
        }).catch(() => {});
      } else {
        fetch('/api/github/repos').then(async (r) => {
          if (r.status === 400) { setGithubConnected(false); return; }
          const d = await r.json();
          setGithubConnected(true);
          setRepos(d.repos ?? []);
        }).catch(() => {});
      }
    } catch {}
  }, []);

  // Generate prompt on mount only if initialInput was provided
  useEffect(() => {
    if (!initialInput.trim()) return;
    if (sessionStorage.getItem('wizard_resume')) return; // skip if restoring
    async function generate() {
      try {
        let input = initialInput;
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

  async function loadRepos() {
    setStep("repo");
    setError("");
    try {
      const r = await fetch("/api/github/repos");
      if (r.status === 400) {
        setGithubConnected(false);
        return;
      }
      const d = await r.json();
      setGithubConnected(true);
      setRepos(d.repos ?? []);
    } catch {
      setError("No se pudieron cargar los repositorios.");
    }
  }

  async function loadVercelProjects() {
    setError("");
    try {
      const r = await fetch("/api/vercel/projects");
      const d = await r.json();
      if (d.error === "Vercel no conectado") {
        setVercelConnected(false);
      } else {
        setVercelConnected(true);
        setVercelProjects(d.projects ?? []);
      }
    } catch {
      setVercelConnected(false);
    }
  }

  function goToRepo() {
    setStep("repo");
    setError("");
    if (deployMethod === "github") loadRepos();
    else loadVercelProjects();
  }

  function switchMethod(m: DeployMethod) {
    setDeployMethod(m);
    setSelectedRepo("");
    setSelectedVercelProject(null);
    setError("");
    if (m === "github") {
      if (githubConnected === null) loadRepos();
    } else {
      loadVercelProjects();
    }
  }

  async function createChatbot() {
    const target =
      deployMethod === "github" ? selectedRepo : selectedVercelProject?.id;
    if (!target || !chatbotName.trim()) return;
    setStep("creating");
    try {
      const colors = { primaryColor: widgetPrimary, secondaryColor: widgetSecondary, widgetStyle, iconType };
      const body =
        deployMethod === "github"
          ? { name: chatbotName, systemPrompt: prompt, githubRepo: selectedRepo, sourceUrl, ...colors }
          : { name: chatbotName, systemPrompt: prompt, vercelProjectId: selectedVercelProject!.id, vercelProjectName: selectedVercelProject!.name, vercelGithubRepo: selectedVercelProject?.link ? `${selectedVercelProject.link.org}/${selectedVercelProject.link.repo}` : null, sourceUrl, ...colors };

      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const canCreate =
    chatbotName.trim() &&
    (deployMethod === "github" ? !!selectedRepo : !!selectedVercelProject);

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Steps dots */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {(["input", "generating", "review", "repo", "creating", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-all ${step === s ? "bg-violet-400 scale-125" : i < (["input","generating","review","repo","creating","done"] as Step[]).indexOf(step) ? "bg-violet-700" : "bg-white/20"}`} />
              {i < 5 && <div className="h-px w-6 bg-white/10" />}
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
                    <input
                      type="color"
                      value={widgetPrimary}
                      onChange={(e) => setWidgetPrimary(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-xs font-mono text-white/70">{widgetPrimary}</span>
                  </div>
                </label>
                <label className="flex-1">
                  <span className="text-xs text-white/50 block mb-1.5">Color secundario</span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <input
                      type="color"
                      value={widgetSecondary}
                      onChange={(e) => setWidgetSecondary(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
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
                    <button
                      key={id}
                      onClick={() => setIconType(id)}
                      title={label}
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
                    <button
                      key={st}
                      onClick={() => setWidgetStyle(st)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${widgetStyle === st ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}
                    >
                      {st}
                    </button>
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

            <button
              onClick={goToRepo}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] cursor-pointer"
            >
              Continuar → Conectar tu web
            </button>
          </div>
        )}

        {/* STEP: Select repo/project */}
        {step === "repo" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">¿Dónde está tu web?</h2>
            <p className="text-white/50 mb-5">Inyectaremos el widget automáticamente.</p>

            {/* Method tabs */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-5">
              <button
                onClick={() => switchMethod("github")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all cursor-pointer ${deployMethod === "github" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub
              </button>
              <button
                onClick={() => switchMethod("vercel")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all cursor-pointer ${deployMethod === "vercel" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}
              >
                <svg className="h-4 w-4" viewBox="0 0 76 65" fill="currentColor">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                Vercel
              </button>
            </div>

            {/* Chatbot name (shared) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">Nombre del chatbot</label>
              <input
                type="text"
                value={chatbotName}
                onChange={(e) => setChatbotName(e.target.value)}
                placeholder="Ej: Asistente de TuEmpresa"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
              />
            </div>

            {/* GitHub repos */}
            {deployMethod === "github" && (
              <>
                {githubConnected === false ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
                    <svg className="h-8 w-8 mx-auto mb-3 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <p className="text-white/50 text-sm mb-4">Conecta tu cuenta de GitHub para ver tus repositorios</p>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('wizard_resume', JSON.stringify({
                          prompt, userInput, inputMode, chatbotName,
                        }));
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
              </>
            )}

            {/* Vercel projects */}
            {deployMethod === "vercel" && (
              <>
                {!vercelConnected ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
                    <div className="text-4xl mb-3">▲</div>
                    <p className="text-white/50 text-sm mb-4">Conecta tu cuenta de Vercel para ver tus proyectos</p>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('wizard_resume', JSON.stringify({
                          prompt, userInput, inputMode, chatbotName, deployMethod: 'vercel',
                        }));
                        window.location.href = '/api/auth/vercel?next=/create';
                      }}
                      className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition cursor-pointer"
                    >
                      Conectar Vercel →
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-white/35 mb-3 leading-relaxed">
                      <span className="text-emerald-400">Verde</span>: inyección automática directa.{" "}
                      <span className="text-amber-400">Amarillo</span>: Next.js/SSR — necesita conectar GitHub también (un clic tras crear).{" "}
                      <span className="text-red-400">Rojo</span>: usa la pestaña GitHub.
                    </p>
                    <input
                      type="text"
                      placeholder="Buscar proyecto..."
                      value={vercelSearch}
                      onChange={(e) => setVercelSearch(e.target.value)}
                      className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 transition"
                    />
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03]">
                      {(() => {
                        const SSR = new Set(['nextjs','nuxtjs','remix','sveltekit','express','hydrogen','angular']);
                        const filtered = vercelProjects.filter(p =>
                          p.name.toLowerCase().includes(vercelSearch.toLowerCase())
                        );
                        if (filtered.length === 0) return (
                          <div className="p-6 text-center text-white/40 text-sm">No se encontraron proyectos</div>
                        );
                        return filtered.map((p) => {
                          const isSSR = SSR.has(p.framework ?? '');
                          const hasGithubLink = !!p.link;
                          // Selectable: static (always) or SSR with GitHub link (will prompt GitHub connect)
                          const available = !isSSR || hasGithubLink;
                          const needsGithub = isSSR && hasGithubLink;
                          return (
                            <button
                              key={p.id}
                              onClick={() => available ? setSelectedVercelProject(p) : undefined}
                              disabled={!available}
                              className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition border-b border-white/5 last:border-0
                                ${selectedVercelProject?.id === p.id ? "bg-violet-500/20 text-white" : available ? "text-white/70 hover:bg-white/5 cursor-pointer" : "text-white/30 cursor-not-allowed"}`}
                            >
                              <span>{p.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-white/25 border border-white/10 rounded px-1.5 py-0.5">
                                  {p.framework ?? "static"}
                                </span>
                                {needsGithub ? (
                                  <span className="text-xs text-amber-400 border border-amber-500/25 rounded px-1.5 py-0.5 bg-amber-500/5">
                                    Via GitHub
                                  </span>
                                ) : available ? (
                                  <span className="text-xs text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5 bg-emerald-500/5">
                                    Disponible
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-400 border border-red-500/25 rounded px-1.5 py-0.5 bg-red-500/5">
                                    Solo GitHub
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}
              </>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              onClick={createChatbot}
              disabled={!canCreate}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Crear chatbot →
            </button>
          </div>
        )}

        {/* STEP: Creating */}
        {step === "creating" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 mb-6">
              <div className="h-6 w-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Creando tu chatbot</h2>
            <p className="text-white/50">Configurando n8n e inyectando el widget…</p>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 mb-6 text-2xl">✓</div>
            <h2 className="text-2xl font-bold mb-2">¡Chatbot creado!</h2>

            {/* Case 1: widget injected directly */}
            {createdChatbot?.widget_injected && (
              <p className="text-white/50 mb-6">
                Widget inyectado en{" "}
                <code className="bg-white/10 px-1 rounded text-xs">{injectFile}</code>.
                Tu chatbot está activo.
              </p>
            )}

            {/* Case 2: PR created — user just needs to merge */}
            {!createdChatbot?.widget_injected && injectPrUrl && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 text-left mb-6">
                <p className="text-sm font-semibold text-violet-300 mb-1">Un paso más: acepta el PR en GitHub</p>
                <p className="text-xs text-white/50 mb-4">
                  No podemos hacer commit directo en tu rama principal (está protegida). Hemos creado una Pull Request automáticamente.
                  Solo tienes que abrirla y pulsar &ldquo;Merge pull request&rdquo;.
                </p>
                <a
                  href={injectPrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full text-center rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition"
                >
                  Ver Pull Request en GitHub →
                </a>
              </div>
            )}

            {/* Case 3a: SSR project — needs GitHub */}
            {!createdChatbot?.widget_injected && !injectPrUrl && injectReason === 'SSR_NEEDS_GITHUB' && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 text-left mb-6">
                <p className="text-sm font-semibold text-violet-300 mb-1">Un paso más: conecta GitHub</p>
                <p className="text-xs text-white/50 mb-4">
                  Tu proyecto usa Next.js. Para que el widget se inyecte automáticamente, conecta tu cuenta de GitHub. Es un solo clic y después todo es automático.
                </p>
                <a
                  href="/api/auth/github?next=/dashboard"
                  className="block w-full text-center rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition"
                >
                  Conectar GitHub →
                </a>
                <p className="text-xs text-white/30 mt-3">
                  Tras conectar, usa &ldquo;Reconectar widget&rdquo; en tu chatbot del dashboard.
                </p>
              </div>
            )}

            {/* Case 3b: could not inject at all — show manual snippet */}
            {!createdChatbot?.widget_injected && !injectPrUrl && injectReason !== 'SSR_NEEDS_GITHUB' && (
              <>
                <p className="text-white/50 mb-4">
                  Tu chatbot está activo. Añade este snippet antes del{" "}
                  <code className="bg-white/10 px-1 rounded">&lt;/body&gt;</code> de tu web:
                </p>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left mb-4">
                  <pre className="text-xs text-violet-300 whitespace-pre-wrap break-all">{`<script>window.ChatbotConfig={webhookUrl:"${createdChatbot?.n8n_webhook_url}"};</script>\n<script src="https://chatbot-builder-iota.vercel.app/widget.js" async defer></script>`}</pre>
                </div>
                {injectReason && (
                  <p className="text-xs text-white/30 mb-4">Motivo: {injectReason}</p>
                )}
              </>
            )}

            <button
              onClick={() => router.push("/dashboard")}
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

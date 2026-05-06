"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "generating" | "review" | "repo" | "creating" | "done";

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
  html_url: string;
}

export function CreateWizard({
  initialMode,
  initialInput,
}: {
  initialMode: string;
  initialInput: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("generating");
  const [prompt, setPrompt] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [chatbotName, setChatbotName] = useState("");
  const [error, setError] = useState("");
  const [createdChatbot, setCreatedChatbot] = useState<{ n8n_webhook_url: string } | null>(null);

  useEffect(() => {
    async function generate() {
      try {
        let input = initialInput;

        if (initialMode === "url" && initialInput) {
          const scrapeRes = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: initialInput }),
          });
          const scrapeData = await scrapeRes.json();
          if (scrapeData.text) input = scrapeData.text;
        }

        const res = await fetch("/api/generate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const data = await res.json();
        if (data.prompt) {
          setPrompt(data.prompt);
          setStep("review");
        } else {
          setError("No se pudo generar el prompt. Inténtalo de nuevo.");
        }
      } catch {
        setError("Error de conexión. Inténtalo de nuevo.");
      }
    }

    generate();
  }, []);

  async function loadRepos() {
    setStep("repo");
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      setRepos(data.repos ?? []);
    } catch {
      setError("No se pudieron cargar los repositorios.");
    }
  }

  async function createChatbot() {
    if (!selectedRepo || !chatbotName.trim()) return;
    setStep("creating");
    try {
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: chatbotName,
          systemPrompt: prompt,
          githubRepo: selectedRepo,
        }),
      });
      const data = await res.json();
      if (data.chatbot) {
        setCreatedChatbot(data.chatbot);
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

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {(["generating", "review", "repo", "creating", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full transition-all ${
                  step === s
                    ? "bg-violet-400 scale-125"
                    : ["done", "creating", "repo", "review"].indexOf(s) <
                      ["done", "creating", "repo", "review", "generating"].indexOf(step)
                    ? "bg-violet-700"
                    : "bg-white/20"
                }`}
              />
              {i < 4 && <div className="h-px w-6 bg-white/10" />}
            </div>
          ))}
        </div>

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
            <h2 className="text-2xl font-bold mb-2">Tu system prompt</h2>
            <p className="text-white/50 mb-6">
              Revisa y edita el prompt que usará tu chatbot.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
            />
            <button
              onClick={loadRepos}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition active:scale-[0.99] cursor-pointer"
            >
              Continuar → Conectar repositorio
            </button>
          </div>
        )}

        {/* STEP: Select repo */}
        {step === "repo" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Elige tu repositorio</h2>
            <p className="text-white/50 mb-4">
              Inyectaremos el widget automáticamente en tu repo.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Nombre del chatbot
              </label>
              <input
                type="text"
                value={chatbotName}
                onChange={(e) => setChatbotName(e.target.value)}
                placeholder="Ej: Asistente de TuEmpresa"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03]">
              {repos.length === 0 ? (
                <div className="p-6 text-center text-white/40 text-sm">
                  Cargando repositorios…
                </div>
              ) : (
                repos.map((r) => (
                  <button
                    key={r.full_name}
                    onClick={() => setSelectedRepo(r.full_name)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition border-b border-white/5 last:border-0 cursor-pointer ${
                      selectedRepo === r.full_name
                        ? "bg-violet-500/20 text-white"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <span>{r.full_name}</span>
                    {r.private && (
                      <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5">
                        privado
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              onClick={createChatbot}
              disabled={!selectedRepo || !chatbotName.trim()}
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
            <p className="text-white/50">
              Configurando el workflow en n8n e inyectando el widget…
            </p>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 mb-6 text-3xl">
              ✓
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Chatbot creado!</h2>
            <p className="text-white/50 mb-6">
              El widget ya está en tu repositorio. Tu chatbot está activo.
            </p>
            {createdChatbot && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left mb-6">
                <p className="text-xs text-white/40 mb-1">Webhook URL</p>
                <p className="text-sm font-mono text-violet-300 break-all">
                  {createdChatbot.n8n_webhook_url}
                </p>
              </div>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectVercelPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/create?vercel=1");
      } else {
        setError(data.error ?? "Token inválido");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
          <svg viewBox="0 0 76 65" className="h-5 w-5" fill="black">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
        </div>
        <span className="text-white/40">+</span>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
          <span className="text-xl font-bold">C</span>
        </div>
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Conectar Vercel</h1>
        <p className="text-white/50 text-center text-sm mb-8">
          Autoriza el acceso a tus proyectos de Vercel para inyectar el chatbot automáticamente.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-white/70 mb-4">
            1. Ve a{" "}
            <a
              href="https://vercel.com/account/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              vercel.com/account/tokens
            </a>
          </p>
          <p className="text-sm text-white/70 mb-6">
            2. Crea un token con nombre <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white">Chatbot Builder</span> y pégalo aquí:
          </p>

          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="vcp_••••••••••••••••••••••••"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 font-mono mb-4"
          />

          {error && (
            <p className="text-sm text-red-400 mb-4">{error}</p>
          )}

          <button
            onClick={connect}
            disabled={loading || !token.trim()}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Verificando…" : "Autorizar acceso →"}
          </button>
        </div>

        <button
          onClick={() => router.back()}
          className="mt-4 w-full text-sm text-white/30 hover:text-white/60 transition cursor-pointer"
        >
          ← Volver
        </button>
      </div>
    </main>
  );
}

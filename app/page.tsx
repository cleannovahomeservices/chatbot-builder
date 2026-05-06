"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"describe" | "url">("describe");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4 py-16">
      {/* Badge */}
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Sin código. Sin complicaciones.
      </div>

      {/* Heading */}
      <h1 className="text-center text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        Crea tu chatbot{" "}
        <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          en 30 segundos
        </span>
      </h1>

      <p className="mt-5 max-w-xl text-center text-lg text-white/50">
        Describe tu negocio o pega tu web — nosotros nos encargamos del resto.
      </p>

      {/* Card */}
      <div className="mt-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
        {/* Toggle */}
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setMode("describe")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
              mode === "describe"
                ? "bg-white text-black shadow"
                : "text-white/50 hover:text-white"
            }`}
          >
            Describe tu negocio
          </button>
          <button
            onClick={() => setMode("url")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
              mode === "url"
                ? "bg-white text-black shadow"
                : "text-white/50 hover:text-white"
            }`}
          >
            Pega la URL de tu web
          </button>
        </div>

        {/* Option A — Describe */}
        {mode === "describe" && (
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-white/70">
              ¿A qué se dedica tu empresa?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Ej: Somos una clínica dental en Madrid. Ofrecemos implantes, ortodoncia y blanqueamiento. Nuestro tono es cercano y profesional..."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
            />
            <p className="mt-2 text-right text-xs text-white/25">
              {description.length} caracteres
            </p>
          </div>
        )}

        {/* Option B — URL */}
        {mode === "url" && (
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-white/70">
              URL de tu sitio web
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://tuempresa.com"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
              />
              <button className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer">
                Analizar web
              </button>
            </div>
            <p className="mt-2 text-xs text-white/25">
              Extraeremos la información clave de tu sitio automáticamente.
            </p>
          </div>
        )}

        {/* CTA */}
        <button className="mt-8 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/30 active:scale-[0.99] cursor-pointer">
          Crear mi chatbot →
        </button>
      </div>

      {/* Social proof */}
      <p className="mt-8 text-sm text-white/25">
        Más de{" "}
        <span className="font-semibold text-white/50">1.200 negocios</span> ya
        tienen su chatbot activo
      </p>
    </main>
  );
}

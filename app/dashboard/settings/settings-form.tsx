'use client';

import { useState } from 'react';

interface Props {
  initialName: string;
  email: string;
}

export function SettingsForm({ initialName }: Props) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage({ type: 'error', text: data?.error ?? 'No se pudo guardar' });
        return;
      }
      setMessage({ type: 'ok', text: 'Guardado correctamente' });
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
        />
        <p className="text-[11px] text-white/30 mt-1">Se mostrará en el dashboard y en los chatbots.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || name === initialName}
          className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {message && (
          <span className={`text-xs ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

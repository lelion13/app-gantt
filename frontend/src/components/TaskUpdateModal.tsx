import { useEffect, useState, type FormEvent } from "react";

import { apiJson } from "@/lib/api";
import type { TaskUpdatePublic } from "@/types/api";

type Props = {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function TaskUpdateModal({ taskId, open, onClose, onSaved }: Props) {
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setComment("");
      setProgress("");
      setBlocked(false);
      setError(null);
    }
  }, [open, taskId]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const p = progress.trim() === "" ? null : Number.parseInt(progress, 10);
      if (p !== null && (Number.isNaN(p) || p < 0 || p > 100)) {
        throw new Error("El avance debe estar entre 0 y 100");
      }
      await apiJson<TaskUpdatePublic>(`/tasks/${taskId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment,
          progress: p,
          is_blocked: blocked,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Registrar avance</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-900"
            onClick={() => onClose()}
          >
            Cerrar
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Comentario, % opcional y bloqueo.</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-300">Comentario</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2"
              placeholder="Qué pasó, qué falta…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Avance % (opcional)</span>
            <input
              inputMode="numeric"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:ring-2"
              placeholder="0–100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => setBlocked(e.target.checked)}
            />
            Bloqueada
          </label>
          {error ? (
            <p className="rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
              onClick={() => onClose()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

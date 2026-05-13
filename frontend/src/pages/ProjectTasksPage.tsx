import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type { TaskPublic } from "@/types/api";

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = useState<TaskPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setError(null);
    setTasks(null);
    apiJson<TaskPublic[]>(`/projects/${projectId}/tasks`)
      .then((rows) => {
        if (!cancelled) setTasks(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return <p className="text-sm text-red-300">Proyecto inválido.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Link to="/" className="text-emerald-400/90 hover:underline">
          ← Panel
        </Link>
        <span className="text-slate-600">·</span>
        <Link
          to={`/projects/${projectId}`}
          className="text-emerald-400/90 hover:underline"
        >
          Proyecto
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-white">Tareas</h1>
      {error ? (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : tasks === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-500">No hay tareas en este proyecto.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                to={`/projects/${projectId}/tasks/${t.id}`}
                className="block rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm hover:border-emerald-900/60"
              >
                <span className="font-medium text-slate-100">{t.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {taskStatusLabel(t.status)} · fin {t.end_date}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

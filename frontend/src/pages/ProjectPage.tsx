import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type { ProjectDetail } from "@/types/api";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { userId } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setError(null);
    setProject(null);
    apiJson<ProjectDetail>(`/projects/${projectId}`)
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const isProjectPm = useMemo(
    () => project !== null && userId !== null && userId === project.project_manager_id,
    [project, userId],
  );

  if (!projectId) {
    return <p className="text-sm text-red-300">Proyecto inválido.</p>;
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-xs text-emerald-400/90 hover:underline">
        ← Panel
      </Link>
      {error ? (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : project === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold text-white">{project.title}</h1>
            {project.description ? (
              <p className="mt-2 text-sm text-slate-300">{project.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {taskStatusLabel(project.status)} · {project.start_date} →{" "}
              {project.end_date}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/projects/${project.id}/tasks`}
              className="inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Ver tareas
            </Link>
            {isProjectPm ? (
              <Link
                to={`/projects/${project.id}/tasks#nueva`}
                className="inline-flex rounded-md border border-emerald-700/80 px-3 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-950/50"
              >
                Nueva tarea
              </Link>
            ) : null}
          </div>
          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <h2 className="text-sm font-semibold text-white">Miembros</h2>
            <ul className="mt-2 divide-y divide-slate-800/80">
              {project.members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="text-slate-100">{m.name}</span>
                  <span className="text-xs text-slate-500">{m.email}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] uppercase text-slate-300">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

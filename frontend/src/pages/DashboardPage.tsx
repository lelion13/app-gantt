import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type { DashboardView, ProjectListItem, TaskDashboardItem } from "@/types/api";

function TaskBucket({
  title,
  subtitle,
  view,
}: {
  title: string;
  subtitle: string;
  view: DashboardView;
}) {
  const [items, setItems] = useState<TaskDashboardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setItems(null);
    apiJson<TaskDashboardItem[]>(`/me/tasks?view=${view}`)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
      <ul className="mt-3 space-y-2">
        {error ? (
          <li className="text-xs text-red-300">{error}</li>
        ) : items === null ? (
          <li className="text-xs text-slate-500">Cargando…</li>
        ) : items.length === 0 ? (
          <li className="text-xs text-slate-500">Sin tareas.</li>
        ) : (
          items.map((t) => (
            <li key={t.id}>
              <Link
                to={`/projects/${t.project_id}/tasks/${t.id}`}
                className="block rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-left text-sm hover:border-emerald-900/60"
              >
                <span className="font-medium text-slate-100">{t.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {t.project_title}
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span>{taskStatusLabel(t.status)}</span>
                  <span>·</span>
                  <span>
                    Fin {t.end_date} {view === "overdue" ? "(vencida)" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export default function DashboardPage() {
  const { role } = useAuth();
  const canCreateProject = role === "admin" || role === "pm";
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [projErr, setProjErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<ProjectListItem[]>("/projects")
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setProjErr(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Panel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Resumen mobile-first de tus tareas.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Proyectos</h2>
          {canCreateProject ? (
            <Link
              to="/projects/new"
              className="rounded-md bg-emerald-800/80 px-2.5 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-700/90"
            >
              Nuevo proyecto
            </Link>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">Donde participás como miembro.</p>
        <ul className="mt-3 space-y-2">
          {projErr ? (
            <li className="text-xs text-red-300">{projErr}</li>
          ) : projects === null ? (
            <li className="text-xs text-slate-500">Cargando…</li>
          ) : projects.length === 0 ? (
            <li className="text-xs text-slate-500">No tenés proyectos asignados.</li>
          ) : (
            projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="block rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-sm hover:border-emerald-900/60"
                >
                  <span className="font-medium text-slate-100">{p.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {taskStatusLabel(p.status)}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <TaskBucket title="Mis tareas" subtitle="Asignadas a vos" view="mine" />
        <TaskBucket
          title="En progreso"
          subtitle="Asignadas en estado en progreso"
          view="in_progress"
        />
        <TaskBucket
          title="Vencidas"
          subtitle="Fin anterior a hoy (APP_TIMEZONE)"
          view="overdue"
        />
      </div>
    </div>
  );
}

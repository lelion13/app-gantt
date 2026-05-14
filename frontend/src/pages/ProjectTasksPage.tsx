import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type {
  LifecycleStatus,
  ProjectDetail,
  TaskCreateBody,
  TaskDetail,
  TaskPublic,
} from "@/types/api";

const STATUSES: LifecycleStatus[] = [
  "pending",
  "estimated",
  "in_progress",
  "completed",
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [status, setStatus] = useState<LifecycleStatus>("pending");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /* Carga proyecto + tareas en paralelo (mismo patrón que detalle de tarea). */
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setError(null);
    setProject(null);
    setTasks(null);
    Promise.all([
      apiJson<ProjectDetail>(`/projects/${projectId}`),
      apiJson<TaskPublic[]>(`/projects/${projectId}/tasks`),
    ])
      .then(([p, rows]) => {
        if (!cancelled) {
          setProject(p);
          setTasks(rows);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const isProjectPm =
    project !== null && userId !== null && userId === project.project_manager_id;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#nueva" && isProjectPm) {
      setShowCreate(true);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, [isProjectPm]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !isProjectPm) return;
    setCreateErr(null);
    if (endDate < startDate) {
      setCreateErr("La fecha de fin debe ser mayor o igual que la de inicio.");
      return;
    }
    const body: TaskCreateBody = {
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      start_date: startDate,
      end_date: endDate,
      status,
    };
    setCreating(true);
    try {
      const created = await apiJson<TaskDetail>(`/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      navigate(`/projects/${projectId}/tasks/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setCreateErr("No tenés permiso para esta acción.");
        else setCreateErr(err.message);
      } else {
        setCreateErr(err instanceof Error ? err.message : "Error");
      }
    } finally {
      setCreating(false);
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-white">Tareas</h1>
        {isProjectPm ? (
          <button
            type="button"
            onClick={() => {
              setShowCreate((v) => !v);
              setCreateErr(null);
            }}
            className="rounded-md bg-emerald-800/80 px-2.5 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-700/90"
          >
            {showCreate ? "Cerrar formulario" : "Nueva tarea"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : tasks === null || project === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          {showCreate && isProjectPm ? (
            <form
              onSubmit={onCreate}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4"
            >
              <h2 className="text-sm font-semibold text-white">Nueva tarea</h2>
              <label className="block text-sm">
                <span className="text-slate-300">Título</span>
                <input
                  required
                  minLength={1}
                  maxLength={255}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-300">Descripción (opcional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-300">Inicio</span>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Fin</span>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-300">Estado</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LifecycleStatus)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {taskStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              {createErr ? <p className="text-sm text-red-300">{createErr}</p> : null}
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {creating ? "Creando…" : "Crear tarea"}
              </button>
            </form>
          ) : null}

          {tasks.length === 0 ? (
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
        </>
      )}
    </div>
  );
}

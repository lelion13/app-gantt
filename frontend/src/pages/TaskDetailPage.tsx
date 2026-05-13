import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type { LifecycleStatus, TaskDetail, TaskUpdatePublic } from "@/types/api";

import { TaskUpdateModal } from "@/components/TaskUpdateModal";

const statuses: LifecycleStatus[] = [
  "pending",
  "estimated",
  "in_progress",
  "completed",
];

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<TaskUpdatePublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<LifecycleStatus>("pending");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  function reloadTask() {
    if (!projectId || !taskId) return;
    apiJson<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`)
      .then(setTask)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }

  function reloadUpdates() {
    if (!taskId) return;
    apiJson<TaskUpdatePublic[]>(`/tasks/${taskId}/updates`)
      .then(setUpdates)
      .catch(() => setUpdates([]));
  }

  useEffect(() => {
    if (!projectId || !taskId) return;
    let cancelled = false;
    setError(null);
    setTask(null);
    setUpdates(null);
    Promise.all([
      apiJson<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`),
      apiJson<TaskUpdatePublic[]>(`/tasks/${taskId}/updates`).catch(
        () => [] as TaskUpdatePublic[],
      ),
    ])
      .then(([t, u]) => {
        if (!cancelled) {
          setTask(t);
          setUpdates(u);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  useEffect(() => {
    if (task) setStatus(task.status);
  }, [task]);

  async function onSaveStatus(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !taskId || !task || !status) return;
    if (status === task.status) {
      setStatusMsg("Sin cambios");
      return;
    }
    setStatusMsg(null);
    setStatusLoading(true);
    try {
      const next = await apiJson<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setTask(next);
      setStatus(next.status);
      setStatusMsg("Guardado");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setStatusLoading(false);
    }
  }

  if (!projectId || !taskId) {
    return <p className="text-sm text-red-300">Ruta inválida.</p>;
  }

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
        <span className="text-slate-600">·</span>
        <Link
          to={`/projects/${projectId}/tasks`}
          className="text-emerald-400/90 hover:underline"
        >
          Tareas
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : task === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold text-white">{task.title}</h1>
            {task.description ? (
              <p className="mt-2 text-sm text-slate-300">{task.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {taskStatusLabel(task.status)} · {task.start_date} → {task.end_date}
            </p>
          </div>

          <form
            onSubmit={onSaveStatus}
            className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"
          >
            <h2 className="text-sm font-semibold text-white">Estado de la tarea</h2>
            <p className="text-xs text-slate-500">
              Solo si tenés permiso (PM o asignado según reglas de la API).
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-400">
                Estado
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LifecycleStatus)}
                  className="mt-1 block w-full min-w-[12rem] rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {taskStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={statusLoading}
                className="rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {statusLoading ? "Guardando…" : "Guardar estado"}
              </button>
            </div>
            {statusMsg ? (
              <p className="mt-2 text-xs text-slate-400">{statusMsg}</p>
            ) : null}
          </form>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              onClick={() => setModalOpen(true)}
            >
              Registrar avance…
            </button>
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <h2 className="text-sm font-semibold text-white">Asignados</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {task.assignees.length === 0 ? (
                <li className="text-xs text-slate-500">Nadie asignado.</li>
              ) : (
                task.assignees.map((a) => (
                  <li key={a.user_id}>
                    {a.name} <span className="text-slate-500">({a.email})</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <h2 className="text-sm font-semibold text-white">Bitácora</h2>
            {updates === null ? (
              <p className="mt-2 text-xs text-slate-500">Cargando…</p>
            ) : updates.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Sin registros aún.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-2 text-sm"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                      <span>{u.author_name}</span>
                      <span>{new Date(u.created_at).toLocaleString("es-AR")}</span>
                    </div>
                    <p className="mt-1 text-slate-100">{u.comment || "—"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Avance: {u.progress ?? "—"}% · Bloqueada:{" "}
                      {u.is_blocked ? "sí" : "no"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <TaskUpdateModal
            taskId={taskId}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              reloadTask();
              reloadUpdates();
            }}
          />
        </>
      )}
    </div>
  );
}

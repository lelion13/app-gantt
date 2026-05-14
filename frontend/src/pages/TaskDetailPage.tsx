import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type {
  LifecycleStatus,
  ProjectDetail,
  TaskAssigneeAddBody,
  TaskDetail,
  TaskUpdateBody,
  TaskUpdatePublic,
} from "@/types/api";

import { TaskUpdateModal } from "@/components/TaskUpdateModal";

const statuses: LifecycleStatus[] = [
  "pending",
  "estimated",
  "in_progress",
  "completed",
];

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tenés permiso para esta acción.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Error";
}

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [updates, setUpdates] = useState<TaskUpdatePublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editStatus, setEditStatus] = useState<LifecycleStatus>("pending");
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [assignPick, setAssignPick] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const isProjectPm = useMemo(
    () => project !== null && userId !== null && userId === project.project_manager_id,
    [project, userId],
  );

  const isAssignedToTask = useMemo(
    () =>
      task !== null &&
      userId !== null &&
      task.assignees.some((a) => a.user_id === userId),
    [task, userId],
  );

  const canEditMetadata = isProjectPm || isAssignedToTask;
  const canPostUpdates = isProjectPm || isAssignedToTask;

  const membersAvailableForAssign = useMemo(() => {
    if (!project || !task) return [];
    const assigned = new Set(task.assignees.map((a) => a.user_id));
    return project.members.filter((m) => !assigned.has(m.user_id));
  }, [project, task]);

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
    setProject(null);
    setTask(null);
    setUpdates(null);
    Promise.all([
      apiJson<ProjectDetail>(`/projects/${projectId}`),
      apiJson<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`),
      apiJson<TaskUpdatePublic[]>(`/tasks/${taskId}/updates`).catch(
        () => [] as TaskUpdatePublic[],
      ),
    ])
      .then(([p, t, u]) => {
        if (!cancelled) {
          setProject(p);
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
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditStart(task.start_date);
    setEditEnd(task.end_date);
    setEditStatus(task.status);
    setMetaMsg(null);
    setAssignPick("");
    setAssignMsg(null);
  }, [task]);

  async function onSaveMetadata(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !taskId || !task) return;
    setMetaMsg(null);

    const body: TaskUpdateBody = {};
    if (isProjectPm) {
      const descNorm = editDescription.trim() === "" ? null : editDescription.trim();
      if (editTitle.trim() !== task.title) body.title = editTitle.trim();
      if (descNorm !== (task.description ?? null)) body.description = descNorm;
      if (editStart !== task.start_date) body.start_date = editStart;
      if (editEnd !== task.end_date) body.end_date = editEnd;
      if (editStatus !== task.status) body.status = editStatus;
    } else if (isAssignedToTask) {
      if (editStart !== task.start_date) body.start_date = editStart;
      if (editEnd !== task.end_date) body.end_date = editEnd;
      if (editStatus !== task.status) body.status = editStatus;
    } else {
      return;
    }

    if (Object.keys(body).length === 0) {
      setMetaMsg("Sin cambios");
      return;
    }

    const effStart = body.start_date ?? task.start_date;
    const effEnd = body.end_date ?? task.end_date;
    if (effEnd < effStart) {
      setMetaMsg("La fecha de fin debe ser mayor o igual que la de inicio.");
      return;
    }

    setMetaLoading(true);
    try {
      const next = await apiJson<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setTask(next);
      setMetaMsg("Guardado");
    } catch (err) {
      setMetaMsg(formatApiError(err));
    } finally {
      setMetaLoading(false);
    }
  }

  async function onAddAssignee(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !taskId || !assignPick) return;
    setAssignMsg(null);
    setAssignLoading(true);
    try {
      const payload: TaskAssigneeAddBody = { user_id: assignPick };
      const next = await apiJson<TaskDetail>(
        `/projects/${projectId}/tasks/${taskId}/assignees`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setTask(next);
      setAssignPick("");
      setAssignMsg("Asignación agregada");
    } catch (err) {
      setAssignMsg(formatApiError(err));
    } finally {
      setAssignLoading(false);
    }
  }

  async function onRemoveAssignee(uid: string) {
    if (!projectId || !taskId) return;
    setAssignMsg(null);
    setAssignLoading(true);
    try {
      const next = await apiJson<TaskDetail>(
        `/projects/${projectId}/tasks/${taskId}/assignees/${uid}`,
        { method: "DELETE" },
      );
      setTask(next);
      setAssignMsg("Asignación quitada");
    } catch (err) {
      setAssignMsg(formatApiError(err));
    } finally {
      setAssignLoading(false);
    }
  }

  async function onDeleteTask() {
    if (!projectId || !taskId) return;
    if (
      !window.confirm(
        "¿Eliminar esta tarea? Es una baja lógica: no se borra de la base de forma física.",
      )
    ) {
      return;
    }
    setMetaMsg(null);
    setDeleteLoading(true);
    try {
      await apiJson<void>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      navigate(`/projects/${projectId}/tasks`);
    } catch (err) {
      setMetaMsg(formatApiError(err));
    } finally {
      setDeleteLoading(false);
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
      ) : task === null || project === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          {!canEditMetadata ? (
            <div>
              <h1 className="text-xl font-semibold text-white">{task.title}</h1>
              {task.description ? (
                <p className="mt-2 text-sm text-slate-300">{task.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {taskStatusLabel(task.status)} · {task.start_date} → {task.end_date}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Solo lectura: no sos el PM ni un asignado a esta tarea.
              </p>
            </div>
          ) : (
            <form
              onSubmit={onSaveMetadata}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3"
            >
              <h2 className="text-sm font-semibold text-white">Datos de la tarea</h2>
              {isProjectPm ? (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-300">Título</span>
                    <input
                      required
                      minLength={1}
                      maxLength={255}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Descripción (opcional)</span>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                </>
              ) : (
                <div>
                  <h1 className="text-lg font-semibold text-white">{task.title}</h1>
                  {task.description ? (
                    <p className="mt-1 text-sm text-slate-300">{task.description}</p>
                  ) : null}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-300">Inicio</span>
                  <input
                    type="date"
                    required
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Fin</span>
                  <input
                    type="date"
                    required
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-300">Estado</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as LifecycleStatus)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
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
                disabled={metaLoading}
                className="rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {metaLoading ? "Guardando…" : "Guardar cambios"}
              </button>
              {metaMsg ? (
                <p
                  className={`text-xs ${
                    metaMsg === "Guardado" || metaMsg === "Sin cambios"
                      ? "text-slate-400"
                      : "text-red-300"
                  }`}
                >
                  {metaMsg}
                </p>
              ) : null}
            </form>
          )}

          {isProjectPm ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => void onDeleteTask()}
                className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-100 hover:bg-red-950/60 disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando…" : "Eliminar tarea"}
              </button>
            </div>
          ) : null}

          {canPostUpdates ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                onClick={() => setModalOpen(true)}
              >
                Registrar avance…
              </button>
            </div>
          ) : null}

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <h2 className="text-sm font-semibold text-white">Asignados</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {task.assignees.length === 0 ? (
                <li className="text-xs text-slate-500">Nadie asignado.</li>
              ) : (
                task.assignees.map((a) => (
                  <li
                    key={a.user_id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {a.name} <span className="text-slate-500">({a.email})</span>
                    </span>
                    {isProjectPm ? (
                      <button
                        type="button"
                        disabled={assignLoading}
                        onClick={() => void onRemoveAssignee(a.user_id)}
                        className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {isProjectPm && membersAvailableForAssign.length > 0 ? (
              <form
                onSubmit={onAddAssignee}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <label className="text-xs text-slate-400">
                  Asignar miembro
                  <select
                    value={assignPick}
                    onChange={(e) => setAssignPick(e.target.value)}
                    className="mt-1 block min-w-[12rem] rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  >
                    <option value="">Elegí…</option>
                    {membersAvailableForAssign.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={assignLoading || !assignPick}
                  className="rounded-md bg-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  {assignLoading ? "…" : "Asignar"}
                </button>
              </form>
            ) : null}
            {isProjectPm &&
            membersAvailableForAssign.length === 0 &&
            task.assignees.length > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Todos los miembros del proyecto ya están asignados.
              </p>
            ) : null}
            {assignMsg ? (
              <p
                className={`mt-2 text-xs ${
                  assignMsg.includes("agregada") || assignMsg.includes("quitada")
                    ? "text-slate-400"
                    : "text-red-300"
                }`}
              >
                {assignMsg}
              </p>
            ) : null}
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

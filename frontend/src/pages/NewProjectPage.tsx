import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { taskStatusLabel } from "@/lib/labels";
import type {
  LifecycleStatus,
  ProjectCreateBody,
  ProjectDetail,
  UserPublic,
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

export default function NewProjectPage() {
  const { role, userId } = useAuth();
  const navigate = useNavigate();
  const canCreate = role === "admin" || role === "pm";

  const [users, setUsers] = useState<UserPublic[] | null>(null);
  const [usersErr, setUsersErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [status, setStatus] = useState<LifecycleStatus>("pending");
  const [pmId, setPmId] = useState("");
  const [collabIds, setCollabIds] = useState<Set<string>>(new Set());
  const [includeMeAsCollaborator, setIncludeMeAsCollaborator] = useState(true);

  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      setUsers([]);
      return;
    }
    let cancelled = false;
    setUsersErr(null);
    setUsers(null);
    apiJson<UserPublic[]>("/users")
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setUsersErr(e instanceof Error ? e.message : "Error al cargar usuarios");
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const eligibleCollaborators = useMemo(() => {
    if (!users || !pmId) return users ?? [];
    return users.filter((u) => u.id !== pmId);
  }, [users, pmId]);

  function toggleCollab(id: string) {
    setCollabIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitErr(null);

    const pm = role === "admin" ? pmId : userId;
    if (!pm) {
      setSubmitErr(
        role === "admin"
          ? "Elegí un responsable del proyecto (PM)."
          : "Sesión inválida.",
      );
      return;
    }
    if (endDate < startDate) {
      setSubmitErr("La fecha de fin debe ser mayor o igual que la de inicio.");
      return;
    }

    const collabs = new Set(collabIds);
    if (role === "admin" && includeMeAsCollaborator && userId && userId !== pm) {
      collabs.add(userId);
    }
    collabs.delete(pm);

    const body: ProjectCreateBody = {
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      start_date: startDate,
      end_date: endDate,
      status,
      project_manager_id: pm,
      initial_collaborator_user_ids: [...collabs],
    };

    setSubmitting(true);
    try {
      const created = await apiJson<ProjectDetail>("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      navigate(`/projects/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setSubmitErr("No tenés permiso para esta acción.");
        else setSubmitErr(err.message);
      } else {
        setSubmitErr(err instanceof Error ? err.message : "Error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCreate) return <Navigate to="/" replace />;

  if (role === "admin" && users === null && !usersErr) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Nuevo proyecto</h1>
        <p className="text-sm text-slate-400">Cargando usuarios…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-white">Nuevo proyecto</h1>
        <Link to="/" className="text-xs text-emerald-400/90 hover:underline">
          ← Panel
        </Link>
      </div>

      {usersErr ? <p className="text-sm text-red-300">{usersErr}</p> : null}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4"
      >
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
            rows={3}
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

        {role === "admin" ? (
          <label className="block text-sm">
            <span className="text-slate-300">Responsable del proyecto (PM)</span>
            <select
              required
              value={pmId}
              onChange={(e) => {
                const v = e.target.value;
                setPmId(v);
                setCollabIds((prev) => {
                  const next = new Set(prev);
                  next.delete(v);
                  return next;
                });
              }}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">Elegí un usuario</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-slate-400">
            Vas a ser el{" "}
            <strong className="text-slate-200">responsable del proyecto (PM)</strong>.
            Podés invitar colaboradores después desde el detalle del proyecto.
          </p>
        )}

        {role === "admin" && pmId ? (
          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-300">
              Colaboradores iniciales (opcional)
            </legend>
            <p className="text-xs text-slate-500">
              Solo verás el proyecto en el panel si sos PM o colaborador del mismo.
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-800 p-2">
              {eligibleCollaborators.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={collabIds.has(u.id)}
                      onChange={() => toggleCollab(u.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="text-slate-200">{u.name}</span>
                      <span className="block text-xs text-slate-500">{u.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {role === "admin" ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeMeAsCollaborator}
              onChange={(e) => setIncludeMeAsCollaborator(e.target.checked)}
              className="mt-1"
            />
            <span className="text-slate-300">
              Incluirme como colaborador inicial
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Así el proyecto aparece en tu panel si no sos el PM.
              </span>
            </span>
          </label>
        ) : null}

        {submitErr ? <p className="text-sm text-red-300">{submitErr}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || (role === "admin" && !pmId)}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "Creando…" : "Crear proyecto"}
          </button>
          <Link
            to="/"
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

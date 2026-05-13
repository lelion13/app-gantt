import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";

import { apiJson } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { AppRole, UserPublic } from "@/types/api";

const roles: AppRole[] = ["admin", "pm", "usuario"];

export default function AdminUsersPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [appRole, setAppRole] = useState<AppRole>("usuario");
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    setError(null);
    apiJson<UserPublic[]>("/users")
      .then(setUsers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setLoading(true);
    try {
      await apiJson<UserPublic>("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          app_role: appRole,
        }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setAppRole("usuario");
      setCreateMsg("Usuario creado");
      reload();
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-white">Usuarios</h1>
        <Link to="/" className="text-xs text-emerald-400/90 hover:underline">
          ← Panel
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
        <h2 className="text-sm font-semibold text-white">Nuevo usuario</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-300">Nombre</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Contraseña (mín. 8)</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-300">Rol app</span>
            <select
              value={appRole}
              onChange={(e) => setAppRole(e.target.value as AppRole)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {createMsg ? (
            <p className="text-xs text-slate-400 sm:col-span-2">{createMsg}</p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
        <h2 className="text-sm font-semibold text-white">Listado</h2>
        {error ? (
          <p className="mt-2 text-sm text-red-300">{error}</p>
        ) : users === null ? (
          <p className="mt-2 text-xs text-slate-500">Cargando…</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-800/80">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-100">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  {u.app_role}
                  {u.deleted_at ? " · inactivo" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

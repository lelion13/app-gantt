import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Ingresar</h1>
        <p className="mt-2 text-center text-sm text-slate-400">app-gantt — MVP</p>
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg"
        >
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-emerald-500/40 focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-emerald-500/40 focus:ring-2"
            />
          </label>
          {error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          API:{" "}
          <code className="text-slate-400">
            {import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}
          </code>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link className="text-emerald-400/90 hover:underline" to="/">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}

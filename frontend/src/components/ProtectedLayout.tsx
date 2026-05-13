import { Link, Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

export function ProtectedLayout() {
  const { token, role, logout } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-white">
            app-gantt
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <Link
              className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800"
              to="/"
            >
              Inicio
            </Link>
            {role === "admin" ? (
              <Link
                className="rounded-md px-2 py-1 text-amber-200/90 hover:bg-slate-800"
                to="/admin/users"
              >
                Usuarios
              </Link>
            ) : null}
            <span className="hidden rounded-md bg-slate-800 px-2 py-1 text-slate-400 sm:inline">
              Rol: {role ?? "—"}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800"
              onClick={() => logout()}
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}

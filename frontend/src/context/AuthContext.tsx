/* eslint-disable react-refresh/only-export-components -- hook + provider en el mismo módulo (MVP) */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiJson } from "@/lib/api";
import { decodeJwtPayload, isJwtExpired } from "@/lib/jwt";
import { TOKEN_KEY } from "@/lib/session";

type AuthContextValue = {
  token: string | null;
  userId: string | null;
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readTokenFromStorage(): string | null {
  const t = sessionStorage.getItem(TOKEN_KEY);
  if (!t || isJwtExpired(t)) {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return t;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readTokenFromStorage());

  useEffect(() => {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }, [token]);

  const payload = useMemo(() => (token ? decodeJwtPayload(token) : null), [token]);
  const userId = payload?.sub ?? null;
  const role = payload?.role ?? null;

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiJson<{ access_token: string }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    setToken(res.access_token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ token, userId, role, login, logout }),
    [token, userId, role, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

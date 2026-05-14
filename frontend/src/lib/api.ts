import { API_BASE_URL } from "@/config";
import { TOKEN_KEY } from "@/lib/session";

/** Error HTTP de la API (status + mensaje seguro para mostrar). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j: unknown = await res.json();
    if (typeof j === "object" && j !== null && "detail" in j) {
      const d = (j as { detail: unknown }).detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d))
        return d
          .map((x) =>
            typeof x === "object" && x && "msg" in x
              ? String((x as { msg: unknown }).msg)
              : String(x),
          )
          .join(", ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Error";
}

export type ApiFetchOptions = RequestInit & {
  /** Si false, no envía Bearer aunque exista token */
  auth?: boolean;
};

export async function apiFetch(
  path: string,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const { auth = true, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (auth) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, { ...rest, headers });
  if (res.status === 401 && auth) {
    sessionStorage.removeItem(TOKEN_KEY);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
  }
  return res;
}

export async function apiJson<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

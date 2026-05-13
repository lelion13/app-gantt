/** Decodifica payload del JWT (solo UI; la autorización real la hace el backend). */
export function decodeJwtPayload(token: string): {
  sub?: string;
  role?: string;
  exp?: number;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json) as { sub?: string; role?: string; exp?: number };
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const p = decodeJwtPayload(token);
  if (!p?.exp) return false;
  return Date.now() / 1000 >= p.exp;
}

// Minimal typed fetch client for the future backend.
// Every method throws BackendNotConfiguredError when VITE_API_URL is unset,
// so "http" mode fails loudly instead of half-working.

export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      "Backend not configured. Set VITE_API_URL (and VITE_DATA_SOURCE=http) per BACKEND_READINESS.md.",
    );
    this.name = "BackendNotConfiguredError";
  }
}

const TOKEN_KEY = "cc.api_token.v1";

export function getApiBase(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (!base) throw new BackendNotConfiguredError();
  return base;
}

export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setApiToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Non-fatal.
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const token = getApiToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body.
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

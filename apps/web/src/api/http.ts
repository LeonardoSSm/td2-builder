const DEFAULT_API_URL = "/api";
const REQUEST_TIMEOUT_MS = 10000;

function normalizeApiUrl(raw: string): string {
  const input = String(raw ?? "").trim();
  if (!input) throw new Error("VITE_API_URL is empty.");

  // Relative path support (recommended in production behind reverse proxy):
  // VITE_API_URL=/api
  if (input.startsWith("/")) {
    const clean = input.replace(/\/+$/, "");
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${clean}`;
    }
    // Fallback for non-browser contexts.
    return clean;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid VITE_API_URL. Use /api or a full http(s) URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid VITE_API_URL protocol. Only http(s) is allowed.");
  }

  return parsed.href.replace(/\/+$/, "");
}

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL ?? DEFAULT_API_URL);
const CSRF_HEADER = "X-CSRF-Token";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data ?? null;
  }
}

export function isApiError(e: any): e is ApiError {
  return Boolean(e && typeof e === "object" && e.name === "ApiError" && typeof (e as any).status === "number");
}

function assertPath(path: string): void {
  if (!path.startsWith("/")) {
    throw new Error("API path must start with '/'.");
  }
}

let refreshing: Promise<boolean> | null = null;
let csrfToken: string | null = null;
let csrfLoading: Promise<string | null> | null = null;

function isUnsafeMethod(methodRaw: any): boolean {
  const m = String(methodRaw ?? "").toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

function shouldSkipCsrf(path: string): boolean {
  return path === "/auth/csrf" || path === "/auth/setup";
}

async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken && csrfToken.trim()) return csrfToken;
  if (csrfLoading) return csrfLoading;

  csrfLoading = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/csrf`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      if (!res.ok) return null;
      const data: any = await res.json().catch(() => null);
      const t = String(data?.csrfToken ?? "").trim();
      csrfToken = t || null;
      return csrfToken;
    } catch {
      return null;
    } finally {
      csrfLoading = null;
    }
  })();
  return csrfLoading;
}

async function refreshAuth(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      // Refresh rotates the HttpOnly cookie; it is CSRF-protected (double-submit token).
      const token = await ensureCsrfToken();
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { [CSRF_HEADER]: token } : {}) },
        body: "{}",
        cache: "no-store",
        credentials: "include",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function requestJson<T>(path: string, init?: RequestInit, retried?: boolean): Promise<T> {
  assertPath(path);
  const url = `${API_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;

  try {
    const method = String(init?.method ?? "GET").toUpperCase();
    const mergedHeaders = { ...((((init?.headers as any) ?? {}) as any) || {}) } as Record<string, string>;
    if (isUnsafeMethod(method) && !shouldSkipCsrf(path)) {
      const token = await ensureCsrfToken();
      if (token) mergedHeaders[CSRF_HEADER] = token;
    }

    res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new ApiError(0, "Request timed out. Please try again.");
    }
    throw new ApiError(0, `Network error: could not reach API at ${API_URL}.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const method = String(init?.method ?? "GET").toUpperCase();
    const unsafe = isUnsafeMethod(method) && !shouldSkipCsrf(path);

    if (
      res.status === 403 &&
      unsafe &&
      !retried &&
      String(text).toLowerCase().includes("csrf")
    ) {
      csrfToken = null;
      await ensureCsrfToken();
      return requestJson<T>(path, init, true);
    }

    if (
      res.status === 401 &&
      !retried &&
      path !== "/auth/login" &&
      path !== "/auth/refresh" &&
      path !== "/auth/setup"
    ) {
      const ok = await refreshAuth();
      if (ok) return requestJson<T>(path, init, true);
    }

    const msgRaw = data?.message ?? data?.error ?? null;
    const message =
      (Array.isArray(msgRaw) ? msgRaw.map((x: any) => String(x)).filter(Boolean).join(", ") : msgRaw ? String(msgRaw) : null) ||
      (text?.trim() ? text.trim().slice(0, 500) : null) ||
      res.statusText ||
      "Request failed";

    throw new ApiError(res.status, message, data);
  }

  return res.json();
}

export async function apiGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, { headers });
}

export async function apiPost<T>(path: string, body: any, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: any, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

export async function apiPut<T>(path: string, body: any, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: "DELETE",
    headers,
  });
}

export async function apiUpload<T>(path: string, file: File, headers?: Record<string, string>): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return requestJson<T>(path, { method: "POST", body: fd, headers });
}

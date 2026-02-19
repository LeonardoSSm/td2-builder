export type AuditReqLike = {
  originalUrl?: string;
  url?: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
};

export function normalizeAuditPath(pathRaw: string): string {
  const s = String(pathRaw ?? "").trim();
  if (!s) return "/";
  const q = s.indexOf("?");
  const hash = s.indexOf("#");
  const cut = [q, hash].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  const base = cut === undefined ? s : s.slice(0, cut);
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
  return base || "/";
}

export function shouldAuditPath(pathRaw: string): boolean {
  const path = normalizeAuditPath(pathRaw);
  if (!path.startsWith("/api/")) return false;
  if (path.startsWith("/api/health")) return false;
  if (path.startsWith("/api/maps/assets")) return false;
  if (path.startsWith("/api/auth/csrf")) return false;
  return true;
}

export function sanitizeJsonForAudit(value: any): any {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") return Number.isFinite(value) ? value : undefined;
  if (t === "bigint") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((x) => sanitizeJsonForAudit(x)).filter((x) => x !== undefined);
  }
  if (t === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const sv = sanitizeJsonForAudit(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return undefined;
}

export function buildAuditMetaFromReq(req: AuditReqLike): Record<string, any> {
  const path = normalizeAuditPath(String(req?.originalUrl ?? req?.url ?? ""));
  const base: Record<string, any> = {};

  const params = sanitizeJsonForAudit(req?.params);
  if (params && typeof params === "object" && Object.keys(params).length) {
    base.params = params;
  }
  const query = sanitizeJsonForAudit(req?.query);
  if (query && typeof query === "object" && Object.keys(query).length) {
    base.query = query;
  }

  // Never include password/token fields from body in audit.
  if (path.startsWith("/api/auth/login")) {
    const email = String((req as any)?.body?.email ?? "").trim().toLowerCase();
    if (email) base.email = email;
  }
  return base;
}

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import * as express from "express";
import { join } from "path";
import { mkdirSync } from "fs";
import { PrismaService } from "./modules/prisma/prisma.service";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function asBool(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return ["1", "true", "t", "yes", "y", "sim", "s", "on"].includes(s);
}

function parseCookies(header: any): Record<string, string> {
  const s = String(header ?? "");
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const part of s.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function createSecurityHeadersMiddleware(opts: { enableHsts: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    // API responses should never be embedded or execute scripts.
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (opts.enableHsts) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  };
}

type Bucket = { startMs: number; count: number };

function createRateLimiter(opts: { max: number; windowMs: number; keyPrefix?: string }) {
  const buckets = new Map<string, Bucket>();
  const max = Math.max(1, opts.max);
  const windowMs = Math.max(1000, opts.windowMs);
  const prefix = opts.keyPrefix ?? "rl";

  // Prevent unbounded growth in long-running processes.
  const prune = () => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now - b.startMs >= windowMs) buckets.delete(k);
    }
  };
  const t = setInterval(prune, Math.min(windowMs, 5 * 60_000));
  t.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip static map assets route.
    if (req.path.startsWith("/api/maps/assets")) return next();
    // Skip CORS preflight.
    if (String(req.method ?? "").toUpperCase() === "OPTIONS") return next();

    // Cheap opportunistic prune.
    if (buckets.size > 5000) prune();

    const ip = String(req.ip ?? (req.headers["x-forwarded-for"] as any) ?? "").split(",")[0].trim() || "unknown";
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now - b.startMs >= windowMs) {
      buckets.set(key, { startMs: now, count: 1 });
      return next();
    }
    if (b.count >= max) {
      res.status(429).json({ message: "Too many requests. Please wait and try again.", statusCode: 429, error: "Too Many Requests" });
      return;
    }
    b.count += 1;
    next();
  };
}

function shouldAudit(req: Request): boolean {
  const method = String(req.method ?? "").toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE") return false;
  const path = String((req as any).originalUrl ?? req.url ?? "");
  return path.startsWith("/api/admin") || path.startsWith("/api/ai") || path.startsWith("/api/imports");
}

function isUnsafeMethod(methodRaw: string): boolean {
  const method = String(methodRaw ?? "").toUpperCase();
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const prisma: any = app.get(PrismaService);
  const trustProxy = asBool(config.get("TRUST_PROXY") ?? "false");
  if (trustProxy) {
    const http = app.getHttpAdapter().getInstance();
    if (http && typeof http.set === "function") http.set("trust proxy", 1);
  }

  const rawOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:5173,http://127.0.0.1:5173";
  const allowedOrigins = parseAllowedOrigins(rawOrigin);
  app.use(createSecurityHeadersMiddleware({ enableHsts: asBool(config.get("ENABLE_HSTS") ?? "false") }));

  // Limit request body sizes to reduce risk (DoS / huge payloads).
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Best-effort global API rate limit (in-memory).
  const rlMax = Number(config.get("RATE_LIMIT_MAX") ?? 120);
  const rlWindowMs = Number(config.get("RATE_LIMIT_WINDOW_MS") ?? 60_000);
  app.use(createRateLimiter({ max: Number.isFinite(rlMax) ? rlMax : 120, windowMs: Number.isFinite(rlWindowMs) ? rlWindowMs : 60_000 }));

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["Content-Type"],
    credentials: true,
    maxAge: 600,
  });

  app.setGlobalPrefix("api");

  // CSRF protection for cookie-based auth (double-submit token).
  const csrfCookieName = String(config.get("AUTH_COOKIE_CSRF") ?? "td2_csrf").trim() || "td2_csrf";
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (String(req.method ?? "").toUpperCase() === "OPTIONS") return next();
    const path = String((req as any).originalUrl ?? req.url ?? "");
    if (!path.startsWith("/api/")) return next();
    if (!isUnsafeMethod(req.method)) return next();

    // Exemptions:
    // - CSRF token bootstrap endpoint
    // - one-time setup endpoint
    if (path.startsWith("/api/auth/csrf")) return next();
    if (path.startsWith("/api/auth/setup")) return next();

    const cookies = parseCookies(req.headers?.cookie);
    const cookieToken = String(cookies[csrfCookieName] ?? "").trim();
    const headerToken = String((req.headers["x-csrf-token"] as string) ?? "").trim();
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      res.status(403).json({
        message: "Invalid CSRF token",
        error: "Forbidden",
        statusCode: 403,
      });
      return;
    }
    next();
  });

  // Best-effort audit log for sensitive endpoints (admin + AI). Does not log bodies.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!shouldAudit(req)) return next();
    const startedAt = Date.now();
    res.on("finish", () => {
      const userId = String((req as any)?.user?.userId ?? "").trim() || null;
      const ip = String(req.ip ?? (req.headers["x-forwarded-for"] as any) ?? "").split(",")[0].trim() || null;
      const method = String(req.method ?? "");
      const path = String((req as any).originalUrl ?? req.url ?? "");
      const status = Number(res.statusCode ?? 0);
      const ok = status >= 200 && status < 400;
      const durationMs = Date.now() - startedAt;
      try {
        void prisma?.auditLog?.create?.({
          data: {
            userId,
            ip,
            method,
            path,
            status,
            durationMs,
            ok,
            error: ok ? null : `HTTP ${status}`,
            meta: { params: (req as any).params, query: (req as any).query },
          },
        });
      } catch {
        // ignore
      }
    });
    next();
  });

  // Serve uploaded map images (admin uploads) without auth.
  // Important: assets should be embeddable by the web app even when the web origin differs
  // (e.g. user opens http://localhost:5173 but API is http://192.168.x.x:3001).
  const mapsDir = join(__dirname, "..", "data", "maps");
  try {
    mkdirSync(mapsDir, { recursive: true });
  } catch {
    // ignore; if it fails, uploads will fail later with a clear error
  }
  app.use(
    "/api/maps/assets",
    (req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
      next();
    },
    express.static(mapsDir, { fallthrough: false, immutable: true, maxAge: "7d" }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Standardize error responses and avoid leaking internal details.
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(config.get("PORT") ?? 3001);
  // Bind to all interfaces so the API is reachable from other devices on the LAN.
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API running on http://0.0.0.0:${port}/api`);
}
bootstrap();

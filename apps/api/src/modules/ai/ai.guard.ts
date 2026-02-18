import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AccessControlService } from "../access-control/access-control.service";
import type { PermissionKey } from "../access-control/access-control.types";

function asBool(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return ["1", "true", "t", "yes", "y", "sim", "s", "on"].includes(s);
}

function asInt(v: any, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

type Bucket = { startMs: number; count: number };

function parsePermissionsCsv(v: any): PermissionKey[] {
  const s = String(v ?? "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean) as PermissionKey[];
}

@Injectable()
export class AiGuard implements CanActivate {
  private readonly jwt = new JwtAuthGuard();
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: ConfigService,
    private readonly access: AccessControlService,
  ) {
    const prune = () => {
      const windowMs = Math.max(5_000, asInt(this.config.get("AI_RATE_LIMIT_WINDOW_MS"), 60_000));
      const now = Date.now();
      for (const [k, b] of this.buckets) {
        if (now - b.startMs >= windowMs) this.buckets.delete(k);
      }
    };
    const t = setInterval(prune, 60_000);
    t.unref?.();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireAuth = asBool(this.config.get("AI_REQUIRE_AUTH") ?? "true");
    const req = context.switchToHttp().getRequest<any>();

    // Best-effort rate limit to avoid abuse/costs. Keyed by user (if logged) or by IP.
    const windowMs = Math.max(5_000, asInt(this.config.get("AI_RATE_LIMIT_WINDOW_MS"), 60_000));
    const max = Math.max(1, asInt(this.config.get("AI_RATE_LIMIT_MAX"), 30));

    // If auth is required, run auth guard first so we can rate-limit by user id.
    if (requireAuth) {
      const res = this.jwt.canActivate(context) as any;
      const ok = typeof res?.then === "function" ? await res : Boolean(res);
      if (!ok) return false;
    }

    const userId = String(req?.user?.userId ?? req?.user?.id ?? req?.user?.sub ?? "").trim();
    const ip = String(req?.ip ?? req?.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
    const key = userId ? `u:${userId}` : `ip:${ip || "unknown"}`;

    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now - b.startMs >= windowMs) {
      this.buckets.set(key, { startMs: now, count: 1 });
      return true;
    }
    if (b.count >= max) {
      throw new HttpException("AI rate limit exceeded. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }
    b.count += 1;

    // Optional permission gate. Default is to require admin permission.
    const requiredPerms = parsePermissionsCsv(this.config.get("AI_REQUIRE_PERMISSIONS") ?? "ai.chat.use");
    if (requiredPerms.length) {
      if (!userId) throw new ForbiddenException("Missing user identity");
      const perms = await this.access.resolvePermissionsForUser(userId);
      const ok = requiredPerms.every((p) => perms.includes(p));
      if (!ok) throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}

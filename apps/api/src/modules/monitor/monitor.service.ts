import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function pct(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function floorToMinute(d: Date): Date {
  const x = new Date(d);
  x.setSeconds(0, 0);
  return x;
}

function floorToHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(opts?: { takeRequests?: number; takeLogins?: number }) {
    const takeRequests = Math.max(10, Math.min(300, Math.trunc(Number(opts?.takeRequests) || 120)));
    const takeLogins = Math.max(5, Math.min(120, Math.trunc(Number(opts?.takeLogins) || 40)));
    const startedAt = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();
    const mem = process.memoryUsage();

    const dbReady = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    const modelImport: any = (this.prisma as any).importJob;
    const modelAudit: any = (this.prisma as any).auditLog;

    const [
      queue,
      recentJobs,
      counts,
      audit1h,
      audit24h,
      errors24h,
      login24h,
      topUsers24h,
      recentRequests,
      recentLogins,
      timeline1h,
      timeline24h,
      topPaths24h,
    ] = await Promise.all([
      (async () => {
        try {
          if (!modelImport) return null;
          const [queued, processing, failed, done] = await Promise.all([
            modelImport.count({ where: { status: "QUEUED" } }),
            modelImport.count({ where: { status: "PROCESSING" } }),
            modelImport.count({ where: { status: "FAILED" } }),
            modelImport.count({ where: { status: "DONE" } }),
          ]);
          return { queued, processing, failed, done };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelImport) return [];
          return await modelImport.findMany({
            select: { id: true, filename: true, status: true, progress: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          });
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          const [gearItems, weapons, builds, users, maps] = await Promise.all([
            this.prisma.gearItem.count(),
            this.prisma.weapon.count(),
            this.prisma.build.count(),
            this.prisma.accessUser.count(),
            this.prisma.farmMap.count(),
          ]);
          return { gearItems, weapons, builds, users, maps };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return null;
          const from = new Date(Date.now() - 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from } },
            select: { ok: true, durationMs: true, status: true },
            orderBy: { at: "desc" },
            take: 3000,
          });
          const durations = rows.map((r: any) => Number(r.durationMs ?? 0)).filter((n: number) => Number.isFinite(n));
          const total = rows.length;
          const failed = rows.filter((r: any) => !r.ok).length;
          const success = total - failed;
          const err5xx = rows.filter((r: any) => Number(r.status) >= 500).length;
          return {
            total,
            success,
            failed,
            err5xx,
            rpsApprox: Number((total / 3600).toFixed(4)),
            avgMs: total ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / total) : 0,
            p95Ms: Math.round(pct(durations, 95)),
          };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return null;
          const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [total, failed] = await Promise.all([
            modelAudit.count({ where: { at: { gte: from } } }),
            modelAudit.count({ where: { at: { gte: from }, ok: false } }),
          ]);
          return { total, failed, success: total - failed };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return null;
          const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/" } },
            select: { status: true },
            orderBy: { at: "desc" },
            take: 10000,
          });
          const total = rows.length;
          let err4xx = 0;
          let err5xx = 0;
          let other = 0;
          for (const row of rows) {
            const status = Number(row.status ?? 0);
            if (status >= 400 && status < 500) err4xx += 1;
            else if (status >= 500) err5xx += 1;
            else other += 1;
          }
          return { total, err4xx, err5xx, other };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return null;
          const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/auth/login" } },
            select: { ok: true, userId: true, meta: true, ip: true },
            orderBy: { at: "desc" },
            take: 5000,
          });
          const total = rows.length;
          const failed = rows.filter((r: any) => !r.ok).length;
          const success = total - failed;
          const uniq = new Set<string>();
          for (const row of rows) {
            const userId = String(row?.userId ?? "").trim();
            const email = String((row as any)?.meta?.email ?? "").trim().toLowerCase();
            const ip = String(row?.ip ?? "").trim();
            if (userId) uniq.add(`u:${userId}`);
            else if (email) uniq.add(`e:${email}`);
            else if (ip) uniq.add(`i:${ip}`);
          }
          return { total, success, failed, uniqueUsers: uniq.size };
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/" } },
            select: { userId: true, ip: true, status: true, ok: true, at: true, meta: true },
            orderBy: { at: "desc" },
            take: 10000,
          });
          const byIdentity = new Map<
            string,
            {
              identity: string;
              userId: string | null;
              email: string | null;
              ip: string | null;
              total: number;
              failed: number;
              err4xx: number;
              err5xx: number;
              lastAt: string;
            }
          >();
          for (const row of rows) {
            const userId = String(row?.userId ?? "").trim() || null;
            const email = String((row as any)?.meta?.email ?? "").trim().toLowerCase() || null;
            const ip = String(row?.ip ?? "").trim() || null;
            const identity = userId ? `user:${userId}` : email ? `email:${email}` : ip ? `ip:${ip}` : "anonymous";
            const status = Number(row.status ?? 0);
            const prev = byIdentity.get(identity) ?? {
              identity,
              userId,
              email,
              ip,
              total: 0,
              failed: 0,
              err4xx: 0,
              err5xx: 0,
              lastAt: new Date(row.at).toISOString(),
            };
            prev.total += 1;
            if (!row.ok) prev.failed += 1;
            if (status >= 400 && status < 500) prev.err4xx += 1;
            if (status >= 500) prev.err5xx += 1;
            if (new Date(row.at).getTime() > new Date(prev.lastAt).getTime()) prev.lastAt = new Date(row.at).toISOString();
            if (!prev.userId && userId) prev.userId = userId;
            if (!prev.email && email) prev.email = email;
            if (!prev.ip && ip) prev.ip = ip;
            byIdentity.set(identity, prev);
          }
          return Array.from(byIdentity.values())
            .sort((a, b) => b.total - a.total || b.failed - a.failed)
            .slice(0, 20);
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          return await modelAudit.findMany({
            where: { path: { startsWith: "/api/" } },
            select: { id: true, at: true, userId: true, ip: true, method: true, path: true, status: true, durationMs: true, ok: true, error: true },
            orderBy: { at: "desc" },
            take: takeRequests,
          });
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          const rows = await modelAudit.findMany({
            where: { path: { startsWith: "/api/auth/login" } },
            select: { id: true, at: true, userId: true, ip: true, status: true, ok: true, meta: true },
            orderBy: { at: "desc" },
            take: takeLogins,
          });
          return rows.map((r: any) => ({
            id: r.id,
            at: r.at,
            userId: r.userId ?? null,
            ip: r.ip ?? null,
            status: r.status,
            ok: r.ok,
            email: String(r?.meta?.email ?? "").trim() || null,
          }));
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          const now = new Date();
          const from = new Date(now.getTime() - 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/" } },
            select: { at: true, ok: true },
            orderBy: { at: "asc" },
            take: 5000,
          });
          const base = floorToMinute(from).getTime();
          const buckets = Array.from({ length: 60 }, (_, i) => ({
            ts: new Date(base + i * 60_000).toISOString(),
            total: 0,
            failed: 0,
          }));
          for (const r of rows) {
            const idx = Math.floor((floorToMinute(new Date(r.at)).getTime() - base) / 60_000);
            if (idx >= 0 && idx < buckets.length) {
              buckets[idx].total += 1;
              if (!r.ok) buckets[idx].failed += 1;
            }
          }
          return buckets;
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          const now = new Date();
          const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/" } },
            select: { at: true, ok: true },
            orderBy: { at: "asc" },
            take: 10000,
          });
          const base = floorToHour(from).getTime();
          const buckets = Array.from({ length: 24 }, (_, i) => ({
            ts: new Date(base + i * 3_600_000).toISOString(),
            total: 0,
            failed: 0,
          }));
          for (const r of rows) {
            const idx = Math.floor((floorToHour(new Date(r.at)).getTime() - base) / 3_600_000);
            if (idx >= 0 && idx < buckets.length) {
              buckets[idx].total += 1;
              if (!r.ok) buckets[idx].failed += 1;
            }
          }
          return buckets;
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          if (!modelAudit) return [];
          const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const rows = await modelAudit.findMany({
            where: { at: { gte: from }, path: { startsWith: "/api/" } },
            select: { path: true },
            orderBy: { at: "desc" },
            take: 5000,
          });
          const byPath = new Map<string, number>();
          for (const r of rows) {
            const p = String(r.path ?? "");
            byPath.set(p, (byPath.get(p) ?? 0) + 1);
          }
          return Array.from(byPath.entries())
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12);
        } catch {
          return [];
        }
      })(),
    ]);

    return {
      ok: true,
      ts: new Date().toISOString(),
      service: {
        name: "td2-api",
        node: process.version,
        pid: process.pid,
        uptimeSec: Math.round(process.uptime()),
        startedAt,
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
      },
      database: { ready: dbReady },
      queue,
      recentJobs,
      counts,
      audit1h,
      audit24h,
      errors24h,
      login24h,
      topUsers24h,
      timeline1h,
      timeline24h,
      topPaths24h,
      recentRequests,
      recentLogins,
    };
  }
}

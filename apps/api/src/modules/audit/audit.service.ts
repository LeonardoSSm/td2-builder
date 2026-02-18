import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditDto } from "./dto/list-audit.dto";

function asDate(v?: string): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditDto) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const take = Math.min(100, Math.max(1, Number(query.take ?? 20) || 20));
    const skip = (page - 1) * take;

    const q = String(query.q ?? "").trim();
    const userId = String(query.userId ?? "").trim();
    const path = String(query.path ?? "").trim();
    const ok = query.ok === "true" ? true : query.ok === "false" ? false : undefined;
    const from = asDate(query.from ?? "");
    const to = asDate(query.to ?? "");
    const statusFrom = Number(query.statusFrom ?? NaN);
    const statusTo = Number(query.statusTo ?? NaN);

    const where: any = {
      AND: [
        userId ? { userId: { contains: userId, mode: "insensitive" } } : undefined,
        path ? { path: { contains: path, mode: "insensitive" } } : undefined,
        typeof ok === "boolean" ? { ok } : undefined,
        Number.isFinite(statusFrom) ? { status: { gte: statusFrom } } : undefined,
        Number.isFinite(statusTo) ? { status: { lte: statusTo } } : undefined,
        from || to
          ? {
              at: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : undefined,
      ].filter(Boolean),
    };

    if (q) {
      where.AND.push({
        OR: [
          { path: { contains: q, mode: "insensitive" } },
          { error: { contains: q, mode: "insensitive" } },
          { userId: { contains: q, mode: "insensitive" } },
          { ip: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const model: any = (this.prisma as any).auditLog;
    const [total, items] = await Promise.all([
      model.count({ where }),
      model.findMany({
        where,
        orderBy: { at: "desc" },
        skip,
        take,
      }),
    ]);

    return {
      items,
      total,
      page,
      take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  async summary(daysRaw = 1) {
    const days = Math.max(1, Math.min(90, Math.trunc(Number(daysRaw) || 1)));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const model: any = (this.prisma as any).auditLog;

    const [total, success, failed, recent] = await Promise.all([
      model.count({ where: { at: { gte: from } } }),
      model.count({ where: { at: { gte: from }, ok: true } }),
      model.count({ where: { at: { gte: from }, ok: false } }),
      model.findMany({
        where: { at: { gte: from } },
        select: { path: true },
        orderBy: { at: "desc" },
        take: 2000,
      }),
    ]);

    const byPath = new Map<string, number>();
    for (const r of recent) {
      const p = String(r.path ?? "");
      byPath.set(p, (byPath.get(p) ?? 0) + 1);
    }
    const topPaths = Array.from(byPath.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { days, total, success, failed, topPaths };
  }
}


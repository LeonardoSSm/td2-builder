import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async ok() {
    const startedAt = Number(process.uptime() || 0);
    let queue: { queued: number; processing: number; failed: number } | null = null;
    try {
      const model: any = (this.prisma as any).importJob;
      const [queued, processing, failed] = await Promise.all([
        model.count({ where: { status: "QUEUED" } }),
        model.count({ where: { status: "PROCESSING" } }),
        model.count({ where: { status: "FAILED" } }),
      ]);
      queue = { queued, processing, failed };
    } catch {
      queue = null;
    }

    return {
      ok: true,
      service: "td2-api",
      env: String(this.config.get("NODE_ENV") ?? "development"),
      ts: new Date().toISOString(),
      uptimeSec: Math.round(startedAt),
      queue,
    };
  }

  @Get("live")
  live() {
    return { ok: true, live: true, ts: new Date().toISOString() };
  }

  @Get("ready")
  async ready() {
    try {
      // No user input here; still prefer the safe raw query API.
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, ready: true, ts: new Date().toISOString() };
    } catch (e: any) {
      throw new ServiceUnavailableException({
        ok: false,
        ready: false,
        error: String(e?.message ?? e ?? "DB not ready"),
      });
    }
  }
}

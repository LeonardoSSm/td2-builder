import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { RequirePermissions } from "../access-control/decorators/require-permissions.decorator";
import { MonitorService } from "./monitor.service";

@Controller("admin/monitor")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.monitor.view")
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get()
  summary(
    @Query("takeRequests") takeRequestsRaw?: string,
    @Query("takeLogins") takeLoginsRaw?: string,
  ) {
    const takeRequests = Math.max(10, Math.min(300, Math.trunc(Number(takeRequestsRaw) || 120)));
    const takeLogins = Math.max(5, Math.min(120, Math.trunc(Number(takeLoginsRaw) || 40)));
    return this.monitor.summary({ takeRequests, takeLogins });
  }
}

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { RequirePermissions } from "../access-control/decorators/require-permissions.decorator";
import { AuditService } from "./audit.service";
import { ListAuditDto } from "./dto/list-audit.dto";

@Controller("admin/audit")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.audit.view")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: ListAuditDto) {
    return this.audit.list(q);
  }

  @Get("summary")
  summary(@Query("days") days?: string) {
    return this.audit.summary(days ? Number(days) : 1);
  }
}


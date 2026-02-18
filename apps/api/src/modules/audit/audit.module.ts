import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Reflector } from "@nestjs/core";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService, AccessControlService, PermissionsGuard, Reflector],
})
export class AuditModule {}


import { Module } from "@nestjs/common";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Reflector } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService, AccessControlService, PermissionsGuard, Reflector],
})
export class ImportsModule {}

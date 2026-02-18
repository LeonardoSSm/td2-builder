import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessControlController } from "./access-control.controller";
import { AccessControlService } from "./access-control.service";
import { PermissionsGuard } from "./guards/permissions.guard";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, PermissionsGuard, Reflector],
  exports: [AccessControlService, PermissionsGuard],
})
export class AccessControlModule {}

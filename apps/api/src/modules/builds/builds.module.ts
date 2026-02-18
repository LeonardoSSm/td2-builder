import { Module } from "@nestjs/common";
import { BuildsController } from "./builds.controller";
import { BuildsService } from "./builds.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Reflector } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [BuildsController],
  providers: [BuildsService, AccessControlService, PermissionsGuard, Reflector],
})
export class BuildsModule {}

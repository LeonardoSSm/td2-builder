import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { MonitorController } from "./monitor.controller";
import { MonitorService } from "./monitor.service";

@Module({
  controllers: [MonitorController],
  providers: [MonitorService, AccessControlService, PermissionsGuard, Reflector],
})
export class MonitorModule {}


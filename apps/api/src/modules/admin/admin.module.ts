import { Module } from "@nestjs/common";
import { AdminGearItemsController } from "./gear-items/admin-gear-items.controller";
import { AdminWeaponsController } from "./weapons/admin-weapons.controller";
import { AdminGearSetsController } from "./gear-sets/admin-gear-sets.controller";
import { AdminBrandsController } from "./brands/admin-brands.controller";
import { AdminTalentsController } from "./talents/admin-talents.controller";
import { AdminAttributesController } from "./attributes/admin-attributes.controller";
import { AdminService } from "./admin.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Reflector } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [
    AdminGearItemsController,
    AdminWeaponsController,
    AdminGearSetsController,
    AdminBrandsController,
    AdminTalentsController,
    AdminAttributesController,
  ],
  providers: [AdminService, AccessControlService, PermissionsGuard, Reflector],
})
export class AdminModule {}

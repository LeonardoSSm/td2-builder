import { Body, Controller, Delete, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AdminService } from "../admin.service";
import { CreateWeaponDto, UpdateWeaponDto } from "./dto/weapon.dto";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@Controller("admin/weapons")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminWeaponsController {
  constructor(private readonly admin: AdminService) {}

  @Post()
  create(@Body() dto: CreateWeaponDto) {
    return this.admin.createWeapon(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWeaponDto) {
    return this.admin.updateWeapon(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteWeapon(id);
  }
}

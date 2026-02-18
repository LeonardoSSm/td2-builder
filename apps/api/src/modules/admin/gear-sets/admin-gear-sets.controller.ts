import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { AdminService } from "../admin.service";
import { CreateGearSetDto, UpdateGearSetDto } from "./dto/gear-set.dto";

@Controller("admin/gear-sets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminGearSetsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listGearSetsAdmin();
  }

  @Post()
  create(@Body() dto: CreateGearSetDto) {
    return this.admin.createGearSet(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateGearSetDto) {
    return this.admin.updateGearSet(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteGearSet(id);
  }
}

import { Body, Controller, Delete, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AdminService } from "../admin.service";
import { CreateGearItemDto, UpdateGearItemDto } from "./dto/gear-item.dto";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@Controller("admin/gear-items")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminGearItemsController {
  constructor(private readonly admin: AdminService) {}

  @Post()
  create(@Body() dto: CreateGearItemDto) {
    return this.admin.createGearItem(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateGearItemDto) {
    return this.admin.updateGearItem(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteGearItem(id);
  }
}

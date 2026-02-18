import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { AdminService } from "../admin.service";
import { CreateAttributeDto, UpdateAttributeDto } from "./dto/attribute.dto";

@Controller("admin/attributes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminAttributesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listAttributesAdmin();
  }

  @Post()
  create(@Body() dto: CreateAttributeDto) {
    return this.admin.createAttribute(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAttributeDto) {
    return this.admin.updateAttribute(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteAttribute(id);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { AdminService } from "../admin.service";
import { CreateBrandDto, UpdateBrandDto } from "./dto/brand.dto";

@Controller("admin/brands")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminBrandsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listBrandsAdmin();
  }

  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.admin.createBrand(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBrandDto) {
    return this.admin.updateBrand(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteBrand(id);
  }
}

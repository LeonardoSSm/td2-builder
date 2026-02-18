import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../../access-control/guards/permissions.guard";
import { AdminService } from "../admin.service";
import { CreateTalentDto, UpdateTalentDto } from "./dto/talent.dto";

@Controller("admin/talents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.items.manage")
export class AdminTalentsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listTalentsAdmin();
  }

  @Post()
  create(@Body() dto: CreateTalentDto) {
    return this.admin.createTalent(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTalentDto) {
    return this.admin.updateTalent(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.admin.deleteTalent(id);
  }
}

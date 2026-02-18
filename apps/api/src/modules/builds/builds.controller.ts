import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { BuildsService } from "./builds.service";
import { ApplyRecommendedBuildDto, CreateBuildDto, UpdateBuildDto, UpdateRecommendedBuildProfileDto, UpsertRecommendedBuildProfileDto } from "./dto/build.dto";
import { RequirePermissions } from "../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("builds")
export class BuildsController {
  constructor(private readonly builds: BuildsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateBuildDto, @Req() req: any) {
    return this.builds.create(dto, String(req?.user?.userId ?? ""));
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) {
    return this.builds.listMine(String(req?.user?.userId ?? ""));
  }

  @Get("recommended")
  listRecommended() {
    return this.builds.listRecommended();
  }

  @Get("recommended/admin")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("admin.recommended.manage")
  listRecommendedAdmin() {
    return this.builds.listRecommendedProfilesAdmin();
  }

  @Post("recommended/admin")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("admin.recommended.manage")
  upsertRecommendedAdmin(@Body() dto: UpsertRecommendedBuildProfileDto) {
    return this.builds.createRecommendedProfileAdmin(dto);
  }

  @Put("recommended/admin/:id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("admin.recommended.manage")
  updateRecommendedAdmin(@Param("id") id: string, @Body() dto: UpdateRecommendedBuildProfileDto) {
    return this.builds.updateRecommendedProfileAdmin(id, dto);
  }

  @Delete("recommended/admin/:id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("admin.recommended.manage")
  deleteRecommendedAdmin(@Param("id") id: string) {
    return this.builds.deleteRecommendedProfileAdmin(id);
  }

  @Post("recommended/:id/apply")
  @UseGuards(JwtAuthGuard)
  applyRecommended(@Param("id") id: string, @Body() dto: ApplyRecommendedBuildDto, @Req() req: any) {
    return this.builds.applyRecommended(id, dto, String(req?.user?.userId ?? ""));
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  get(@Param("id") id: string, @Req() req: any) {
    return this.builds.get(id, String(req?.user?.userId ?? ""));
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id") id: string, @Body() dto: UpdateBuildDto, @Req() req: any) {
    return this.builds.update(id, dto, String(req?.user?.userId ?? ""));
  }

  @Get(":id/summary")
  @UseGuards(JwtAuthGuard)
  summary(@Param("id") id: string, @Req() req: any) {
    return this.builds.summary(id, String(req?.user?.userId ?? ""));
  }
}

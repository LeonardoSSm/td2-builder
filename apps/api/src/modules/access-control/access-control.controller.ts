import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "./decorators/require-permissions.decorator";
import { PermissionsGuard } from "./guards/permissions.guard";
import { AccessControlService } from "./access-control.service";
import { UpdateAccessProfileDto, UpdateAccessUserDto, UpsertAccessProfileDto, UpsertAccessUserDto } from "./dto/access-control.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("admin/access")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.users.manage")
export class AccessControlController {
  constructor(private readonly access: AccessControlService) {}

  @Get("profiles")
  listProfiles() {
    return this.access.listProfiles();
  }

  @Post("profiles")
  upsertProfile(@Body() dto: UpsertAccessProfileDto) {
    return this.access.upsertProfile({
      id: "",
      name: dto.name,
      permissions: dto.permissions as any,
    });
  }

  @Put("profiles/:id")
  updateProfile(@Param("id") id: string, @Body() dto: UpdateAccessProfileDto) {
    return this.access.updateProfile(id, {
      id,
      name: dto.name,
      permissions: dto.permissions as any,
    });
  }

  @Delete("profiles/:id")
  deleteProfile(@Param("id") id: string) {
    return this.access.deleteProfile(id);
  }

  @Get("users")
  listUsers() {
    return this.access.listUsers();
  }

  @Post("users")
  upsertUser(@Body() dto: UpsertAccessUserDto) {
    return this.access.upsertUser({
      id: "",
      name: dto.name,
      email: dto.email,
      profileId: dto.profileId,
      active: dto.active ?? true,
    });
  }

  @Put("users/:id")
  updateUser(@Param("id") id: string, @Body() dto: UpdateAccessUserDto) {
    return this.access.updateUser(id, {
      id,
      name: dto.name,
      email: dto.email,
      profileId: dto.profileId,
      active: dto.active ?? true,
    });
  }

  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    return this.access.deleteUser(id);
  }
}

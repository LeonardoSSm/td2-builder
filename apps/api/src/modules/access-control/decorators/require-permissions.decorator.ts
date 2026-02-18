import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "../access-control.types";

export const REQUIRE_PERMISSIONS_KEY = "td2.require_permissions";

export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);


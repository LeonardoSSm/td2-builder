import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessControlService } from "../access-control.service";
import { REQUIRE_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import type { PermissionKey } from "../access-control.types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessControlService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(REQUIRE_PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const jwtUserId = typeof (req as any)?.user?.userId === "string" ? String((req as any).user.userId).trim() : null;
    const effectiveUserId = jwtUserId ?? null;
    if (!effectiveUserId) {
      throw new ForbiddenException("Missing user identity");
    }

    const perms = await this.access.resolvePermissionsForUser(effectiveUserId);
    const ok = required.every((p) => perms.includes(p));
    if (!ok) throw new ForbiddenException("Insufficient permissions");
    return true;
  }
}

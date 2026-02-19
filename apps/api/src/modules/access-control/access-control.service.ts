import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessProfile, AccessUser, PermissionKey } from "./access-control.types";
import { PERMISSIONS } from "./access-control.types";
import { randomUUID } from "crypto";

function autoId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normalizePermissions(input: any): PermissionKey[] {
  const list = Array.isArray(input) ? input : [];
  const perms = list
    .map((x) => String(x).trim())
    .filter(Boolean)
    .filter((x) => (PERMISSIONS as readonly string[]).includes(x)) as PermissionKey[];
  return uniq(perms);
}

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles(): Promise<AccessProfile[]> {
    const rows = await this.prisma.accessProfile.findMany({ orderBy: { id: "asc" } });
    return rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      permissions: normalizePermissions(p.permissions),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async upsertProfile(profile: AccessProfile): Promise<AccessProfile> {
    const id = (profile.id ?? "").trim() || autoId("PRF_");
    const name = (profile.name ?? "").trim();
    if (!name) throw new NotFoundException("Invalid profile");

    const permissions = normalizePermissions(profile.permissions);
    const row = await this.prisma.accessProfile.upsert({
      where: { id },
      update: { name, permissions },
      create: { id, name, permissions },
    });
    return {
      id: row.id,
      name: row.name,
      permissions: normalizePermissions(row.permissions),
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
    };
  }

  async updateProfile(id: string, profile: AccessProfile): Promise<AccessProfile> {
    const profileId = (id ?? "").trim();
    const exists = await this.prisma.accessProfile.findUnique({ where: { id: profileId } });
    if (!exists) throw new NotFoundException("Profile not found");
    const name = (profile.name ?? "").trim();
    if (!name) throw new NotFoundException("Invalid profile");
    const permissions = normalizePermissions(profile.permissions);
    const row = await this.prisma.accessProfile.update({
      where: { id: profileId },
      data: { name, permissions },
    });
    return {
      id: row.id,
      name: row.name,
      permissions: normalizePermissions(row.permissions),
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
    };
  }

  async deleteProfile(id: string): Promise<{ ok: true }> {
    const profileId = (id ?? "").trim();
    const exists = await this.prisma.accessProfile.findUnique({ where: { id: profileId } });
    if (!exists) throw new NotFoundException("Profile not found");

    await this.prisma.$transaction([
      // Users referencing this profile become inactive to prevent orphaned permissions.
      this.prisma.accessUser.updateMany({ where: { profileId }, data: { active: false } }),
      this.prisma.accessProfile.delete({ where: { id: profileId } }),
    ]);
    return { ok: true };
  }

  async listUsers(): Promise<AccessUser[]> {
    const rows = await this.prisma.accessUser.findMany({ orderBy: { id: "asc" } });
    return rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? undefined,
      profileId: u.profileId,
      active: u.active,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async upsertUser(user: AccessUser): Promise<AccessUser> {
    const id = (user.id ?? "").trim() || autoId("USR_");
    const name = (user.name ?? "").trim();
    const profileId = (user.profileId ?? "").trim();
    if (!name || !profileId) throw new NotFoundException("Invalid user");

    const profile = await this.prisma.accessProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException("Profile not found");

    const email = user.email ? String(user.email).trim() : null;
    const active = user.active !== false;

    const row = await this.prisma.accessUser.upsert({
      where: { id },
      update: { name, email, profileId, active },
      create: { id, name, email, profileId, active },
    });
    return {
      id: row.id,
      name: row.name,
      email: (row as any).email ?? undefined,
      profileId: row.profileId,
      active: row.active,
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
    };
  }

  async updateUser(id: string, user: AccessUser): Promise<AccessUser> {
    const userId = (id ?? "").trim();
    const exists = await this.prisma.accessUser.findUnique({ where: { id: userId } });
    if (!exists) throw new NotFoundException("User not found");

    const name = (user.name ?? "").trim();
    const profileId = (user.profileId ?? "").trim();
    if (!name || !profileId) throw new NotFoundException("Invalid user");

    const profile = await this.prisma.accessProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException("Profile not found");

    const email = user.email ? String(user.email).trim() : null;
    const active = user.active !== false;

    const row = await this.prisma.accessUser.update({
      where: { id: userId },
      data: { name, email, profileId, active },
    });
    return {
      id: row.id,
      name: row.name,
      email: (row as any).email ?? undefined,
      profileId: row.profileId,
      active: row.active,
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
    };
  }

  async deleteUser(id: string): Promise<{ ok: true }> {
    const userId = (id ?? "").trim();
    const exists = await this.prisma.accessUser.findUnique({ where: { id: userId } });
    if (!exists) throw new NotFoundException("User not found");
    await this.prisma.accessUser.delete({ where: { id: userId } });
    return { ok: true };
  }

  async resolvePermissionsForUser(userId: string): Promise<PermissionKey[]> {
    const id = (userId ?? "").trim();
    if (!id) return [];
    const user = await this.prisma.accessUser.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user || !user.active) return [];
    return normalizePermissions(user.profile?.permissions ?? []);
  }
}

import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

const SALT_ROUNDS = 12;
const DUMMY_BCRYPT_HASH = bcrypt.hashSync("td2-builder-dummy-password", SALT_ROUNDS);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function timingSafeEqualHex(aHexRaw: string, bHexRaw: string): boolean {
  const aHex = String(aHexRaw ?? "").trim().toLowerCase();
  const bHex = String(bHexRaw ?? "").trim().toLowerCase();
  // SHA-256 hex is fixed-length 64. Reject anything else to avoid odd buffer behavior.
  if (!/^[0-9a-f]{64}$/.test(aHex) || !/^[0-9a-f]{64}$/.test(bHex)) return false;
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  // Buffers are fixed-length here; timingSafeEqual throws if lengths differ.
  return timingSafeEqual(a, b);
}

function makeRefreshToken(): string {
  // Opaque token stored only in HttpOnly cookie; hash is stored in DB.
  return randomBytes(32).toString("base64url");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(emailRaw: string, password: string) {
    const email = String(emailRaw ?? "").trim().toLowerCase();
    if (!email) throw new BadRequestException("email is required");

    const user = await this.prisma.accessUser.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Always run bcrypt compare to reduce user-enumeration timing differences.
    const candidateHash = String(user?.passwordHash ?? DUMMY_BCRYPT_HASH);
    const ok = await bcrypt.compare(password, candidateHash).catch(() => false);
    if (!user || !user.active || !user.passwordHash || !ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const refreshToken = makeRefreshToken();
    const refreshTokenHash = sha256Hex(refreshToken);

    await this.prisma.accessUser.update({
      where: { id: user.id },
      data: { refreshTokenHash } as any, // prisma client updated after `prisma generate`
    });

    return {
      accessToken,
      refreshToken: `${user.id}.${refreshToken}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: {
          id: user.profile.id,
          name: user.profile.name,
          permissions: user.profile.permissions,
        },
      },
    };
  }

  async refreshFromCookieValue(cookieValueRaw: string) {
    const cookieValue = String(cookieValueRaw ?? "").trim();
    if (!cookieValue) throw new UnauthorizedException("Missing refresh token");
    const idx = cookieValue.indexOf(".");
    if (idx <= 0) throw new UnauthorizedException("Invalid refresh token");
    const userId = cookieValue.slice(0, idx).trim();
    const token = cookieValue.slice(idx + 1).trim();
    if (!userId || !token) throw new UnauthorizedException("Invalid refresh token");

    const user = await this.prisma.accessUser.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.active) throw new UnauthorizedException("Invalid refresh token");
    const storedHash = String((user as any).refreshTokenHash ?? "").trim();
    if (!storedHash) throw new UnauthorizedException("Refresh token not set");

    const ok = timingSafeEqualHex(sha256Hex(token), storedHash);
    if (!ok) throw new UnauthorizedException("Invalid refresh token");

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const newRefreshToken = makeRefreshToken();
    const newRefreshTokenHash = sha256Hex(newRefreshToken);

    await this.prisma.accessUser.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash } as any, // prisma client updated after `prisma generate`
    });

    return {
      accessToken,
      refreshToken: `${user.id}.${newRefreshToken}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: {
          id: user.profile.id,
          name: user.profile.name,
          permissions: user.profile.permissions,
        },
      },
    };
  }

  async logout(userId: string) {
    const id = String(userId ?? "").trim();
    if (!id) return { ok: true };
    await this.prisma.accessUser.update({ where: { id }, data: { refreshTokenHash: null } as any });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.accessUser.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.active) throw new UnauthorizedException("Invalid user");

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: {
        id: user.profile.id,
        name: user.profile.name,
        permissions: user.profile.permissions,
      },
    };
  }

  async adminSetPassword(input: {
    userId?: string;
    email?: string;
    password: string;
    profileId?: string;
    name?: string;
  }) {
    const password = String(input.password ?? "");
    if (password.length < 6) throw new BadRequestException("Password too short");

    const email = input.email ? String(input.email).trim().toLowerCase() : undefined;
    const userId = input.userId ? String(input.userId).trim() : undefined;
    if (!email && !userId) {
      throw new BadRequestException("Provide userId or email");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const existing = userId
      ? await this.prisma.accessUser.findUnique({ where: { id: userId } })
      : await this.prisma.accessUser.findUnique({ where: { email: email! } });

    if (existing) {
      await this.prisma.accessUser.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      return { ok: true, userId: existing.id, updated: true };
    }

    if (!email) throw new BadRequestException("email is required to create a new user");

    const created = await this.prisma.accessUser.create({
      data: {
        ...(userId && userId.length ? { id: userId } : {}),
        name: input.name?.trim() || email,
        email,
        active: true,
        profileId: input.profileId?.trim() || "admin",
        passwordHash,
      },
    });

    return { ok: true, userId: created.id, created: true };
  }

  private async getPermissionsForUser(userId: string): Promise<string[]> {
    const u = await this.prisma.accessUser.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!u || !u.active) throw new UnauthorizedException("Invalid user");
    return u.profile.permissions ?? [];
  }

  async setMyPassword(userId: string, password: string) {
    const p = String(password ?? "");
    if (p.length < 6) throw new BadRequestException("Password too short");
    const passwordHash = await bcrypt.hash(p, SALT_ROUNDS);
    await this.prisma.accessUser.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  async setUserPassword(actorUserId: string, targetUserId: string, password: string) {
    const perms = await this.getPermissionsForUser(actorUserId);
    if (!perms.includes("admin.users.manage")) throw new ForbiddenException("Insufficient permissions");
    const p = String(password ?? "");
    if (p.length < 6) throw new BadRequestException("Password too short");
    const passwordHash = await bcrypt.hash(p, SALT_ROUNDS);
    await this.prisma.accessUser.update({ where: { id: targetUserId }, data: { passwordHash } });
    return { ok: true };
  }

  // One-time bootstrap when no passwords exist yet. Sets the 'root' user password.
  async setupRootPassword(password: string) {
    const p = String(password ?? "");
    if (p.length < 6) throw new BadRequestException("Password too short");

    const anyHasPassword = await this.prisma.accessUser.findFirst({
      where: { passwordHash: { not: null } },
      select: { id: true },
    });
    if (anyHasPassword) throw new ForbiddenException("Setup already completed");

    const root = await this.prisma.accessUser.findUnique({ where: { id: "root" } });
    if (!root) throw new BadRequestException("Root user not found");

    const passwordHash = await bcrypt.hash(p, SALT_ROUNDS);
    await this.prisma.accessUser.update({ where: { id: "root" }, data: { passwordHash } });
    return { ok: true };
  }
}

import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { SetPasswordDto } from "./dto/set-password.dto";
import { SetupDto } from "./dto/setup.dto";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";

type LoginBucket = { startMs: number; fails: number };

@Controller("auth")
export class AuthController {
  private readonly loginBuckets = new Map<string, LoginBucket>();

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    const prune = () => {
      const windowMs = Math.max(1_000, this.asInt(this.config.get("LOGIN_RATE_LIMIT_WINDOW_MS"), 60_000));
      const now = Date.now();
      for (const [k, b] of this.loginBuckets) {
        if (now - b.startMs >= windowMs) this.loginBuckets.delete(k);
      }
    };
    const t = setInterval(prune, 60_000);
    t.unref?.();
  }

  private asInt(v: any, def: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : def;
  }

  private getClientIp(req: any): string {
    return String(req?.ip ?? req?.headers?.["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim() || "unknown";
  }

  private loginRateLimitKey(req: any, email: string): string {
    const ip = this.getClientIp(req);
    const mail = String(email ?? "").trim().toLowerCase();
    return `${ip}|${mail}`;
  }

  private isLoginRateLimited(key: string): boolean {
    const max = Math.max(1, this.asInt(this.config.get("LOGIN_RATE_LIMIT_MAX"), 10));
    const windowMs = Math.max(1_000, this.asInt(this.config.get("LOGIN_RATE_LIMIT_WINDOW_MS"), 60_000));
    const now = Date.now();
    const b = this.loginBuckets.get(key);
    if (!b) return false;
    if (now - b.startMs >= windowMs) {
      this.loginBuckets.delete(key);
      return false;
    }
    return b.fails >= max;
  }

  private markLoginFailed(key: string): void {
    const windowMs = Math.max(1_000, this.asInt(this.config.get("LOGIN_RATE_LIMIT_WINDOW_MS"), 60_000));
    const now = Date.now();
    const cur = this.loginBuckets.get(key);
    if (!cur || now - cur.startMs >= windowMs) {
      this.loginBuckets.set(key, { startMs: now, fails: 1 });
      return;
    }
    cur.fails += 1;
  }

  private clearLoginBucket(key: string): void {
    this.loginBuckets.delete(key);
  }

  private cookieOpts() {
    const secure = String(this.config.get("COOKIE_SECURE") ?? "false").toLowerCase() === "true";
    const sameSiteRaw = String(this.config.get("COOKIE_SAMESITE") ?? "lax").toLowerCase();
    const sameSite = (sameSiteRaw === "strict" || sameSiteRaw === "none") ? sameSiteRaw : "lax";
    return { httpOnly: true, secure, sameSite: sameSite as any };
  }

  private cookieNames() {
    const access = String(this.config.get("AUTH_COOKIE_ACCESS") ?? "td2_at").trim() || "td2_at";
    const refresh = String(this.config.get("AUTH_COOKIE_REFRESH") ?? "td2_rt").trim() || "td2_rt";
    const csrf = String(this.config.get("AUTH_COOKIE_CSRF") ?? "td2_csrf").trim() || "td2_csrf";
    return { access, refresh, csrf };
  }

  private refreshMaxAgeMs() {
    const days = Number(this.config.get("AUTH_REFRESH_DAYS") ?? 30);
    const d = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : 30;
    return d * 24 * 60 * 60 * 1000;
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const { access, refresh } = this.cookieNames();
    const opts = this.cookieOpts();
    res.cookie(access, accessToken, { ...opts, path: "/" });
    res.cookie(refresh, refreshToken, { ...opts, path: "/api/auth/refresh", maxAge: this.refreshMaxAgeMs() });
  }

  private clearAuthCookies(res: Response) {
    const { access, refresh, csrf } = this.cookieNames();
    const opts = this.cookieOpts();
    res.cookie(access, "", { ...opts, path: "/", maxAge: 0 });
    res.cookie(refresh, "", { ...opts, path: "/api/auth/refresh", maxAge: 0 });
    res.cookie(csrf, "", { ...opts, httpOnly: false, path: "/", maxAge: 0 });
  }

  private parseCookies(header: any): Record<string, string> {
    const s = String(header ?? "");
    const out: Record<string, string> = {};
    if (!s) return out;
    for (const part of s.split(";")) {
      const idx = part.indexOf("=");
      if (idx <= 0) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (!k) continue;
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const key = this.loginRateLimitKey(req, dto.email);
    if (this.isLoginRateLimited(key)) {
      throw new HttpException("Too many login attempts. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }

    try {
      const out = await this.auth.login(dto.email, dto.password);
      this.clearLoginBucket(key);
      this.setAuthCookies(res, out.accessToken, out.refreshToken);
      // Do not return tokens to the browser (cookies are HttpOnly).
      return { user: out.user };
    } catch (e: any) {
      if (e instanceof UnauthorizedException || e?.status === 401) {
        this.markLoginFailed(key);
      }
      throw e;
    }
  }

  @Get("csrf")
  csrf(@Res({ passthrough: true }) res: Response) {
    const { csrf } = this.cookieNames();
    const token = randomBytes(24).toString("base64url");
    const opts = this.cookieOpts();
    res.cookie(csrf, token, { ...opts, httpOnly: false, path: "/", maxAge: this.refreshMaxAgeMs() });
    return { csrfToken: token };
  }

  @Post("refresh")
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { refresh } = this.cookieNames();
    const cookies = this.parseCookies(req?.headers?.cookie);
    const refreshCookie = cookies[refresh];
    const out = await this.auth.refreshFromCookieValue(refreshCookie);
    this.setAuthCookies(res, out.accessToken, out.refreshToken);
    return { ok: true, user: out.user };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user.userId);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.userId);
  }

  @Post("me/password")
  @UseGuards(JwtAuthGuard)
  setMyPassword(@Req() req: any, @Body() dto: SetPasswordDto) {
    return this.auth.setMyPassword(req.user.userId, dto.password);
  }

  @Post("users/:id/password")
  @UseGuards(JwtAuthGuard)
  setUserPassword(@Req() req: any, @Param("id") id: string, @Body() dto: SetPasswordDto) {
    return this.auth.setUserPassword(req.user.userId, id, dto.password);
  }

  // One-time bootstrap (no auth). Works only when no user has a passwordHash yet.
  @Post("setup")
  setup(@Body() dto: SetupDto) {
    return this.auth.setupRootPassword(dto.password);
  }
}

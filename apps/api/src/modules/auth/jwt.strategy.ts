import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

type JwtPayload = {
  sub: string;
  iat?: number;
  exp?: number;
};

function parseCookies(header: any): Record<string, string> {
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) {
      // Fail fast so this is obvious in dev.
      throw new UnauthorizedException("JWT_SECRET is not configured");
    }

    const issuer = (config.get<string>("JWT_ISSUER") ?? "").trim();
    const audience = (config.get<string>("JWT_AUDIENCE") ?? "").trim();
    const accessCookieName = (config.get<string>("AUTH_COOKIE_ACCESS") ?? "td2_at").trim() || "td2_at";

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => {
          const cookies = parseCookies(req?.headers?.cookie);
          return cookies[accessCookieName] || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || typeof payload.sub !== "string") {
      throw new UnauthorizedException("Invalid token payload");
    }
    return { userId: payload.sub };
  }
}

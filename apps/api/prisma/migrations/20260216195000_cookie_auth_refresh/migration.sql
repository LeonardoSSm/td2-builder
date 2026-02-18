-- Cookie auth: refresh token storage (safe on re-run)

ALTER TABLE "AccessUser" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;


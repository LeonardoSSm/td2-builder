-- Add passwordHash to AccessUser for JWT login.

ALTER TABLE "AccessUser" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- Optional: ensure emails remain unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS "AccessUser_email_key" ON "AccessUser"("email");

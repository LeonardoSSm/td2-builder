-- Audit log table + AI permission seed update (safe on re-run)

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "ip" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "error" TEXT,
  "meta" JSONB,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_at_idx" ON "AuditLog"("at");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_path_idx" ON "AuditLog"("path");

-- Ensure root/admin profiles can use AI after migration (safe on re-run)
UPDATE "AccessProfile"
SET "permissions" = array_append("permissions", 'ai.chat.use'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('root', 'admin')
  AND NOT ('ai.chat.use' = ANY("permissions"));


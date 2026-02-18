-- Async import queue jobs (xlsx)
CREATE TABLE IF NOT EXISTS "ImportJob" (
  "import_job_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'xlsx',
  "filename" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalSteps" INTEGER NOT NULL DEFAULT 0,
  "processedSteps" INTEGER NOT NULL DEFAULT 0,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "report" JSONB,
  "error" TEXT,
  "filePath" TEXT,
  "requestedBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("import_job_id")
);

CREATE INDEX IF NOT EXISTS "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

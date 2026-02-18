-- Add optional description field for GearSet.

ALTER TABLE "GearSet"
ADD COLUMN IF NOT EXISTS "description" TEXT;


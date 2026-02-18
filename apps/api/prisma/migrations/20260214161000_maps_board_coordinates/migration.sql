-- Upgrade maps module from lat/lng tiles to board image + normalized coordinates (x/y).
-- Safe to run even if some columns already exist.

-- FarmMap
ALTER TABLE "FarmMap" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "FarmMap" ADD COLUMN IF NOT EXISTS "centerX" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "FarmMap" ADD COLUMN IF NOT EXISTS "centerY" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

DO $$
BEGIN
  -- If zoom is integer (old), convert to double and reset to 1.
  -- If it's already double, this will still succeed.
  BEGIN
    ALTER TABLE "FarmMap" ALTER COLUMN "zoom" TYPE DOUBLE PRECISION USING 1;
  EXCEPTION WHEN others THEN
    -- ignore
  END;
END $$;

ALTER TABLE "FarmMap" ALTER COLUMN "zoom" SET DEFAULT 1;
UPDATE "FarmMap" SET "zoom" = 1 WHERE "zoom" IS NULL OR "zoom" = 0;

ALTER TABLE "FarmMap" DROP COLUMN IF EXISTS "centerLat";
ALTER TABLE "FarmMap" DROP COLUMN IF EXISTS "centerLng";
ALTER TABLE "FarmMap" DROP COLUMN IF EXISTS "tileUrl";

-- FarmArea
ALTER TABLE "FarmArea" ADD COLUMN IF NOT EXISTS "x" DOUBLE PRECISION;
ALTER TABLE "FarmArea" ADD COLUMN IF NOT EXISTS "y" DOUBLE PRECISION;
ALTER TABLE "FarmArea" ADD COLUMN IF NOT EXISTS "radiusPx" INTEGER NOT NULL DEFAULT 60;

UPDATE "FarmArea" SET "x" = COALESCE("x", 0.5), "y" = COALESCE("y", 0.5) WHERE "x" IS NULL OR "y" IS NULL;

ALTER TABLE "FarmArea" ALTER COLUMN "x" SET NOT NULL;
ALTER TABLE "FarmArea" ALTER COLUMN "y" SET NOT NULL;

ALTER TABLE "FarmArea" DROP COLUMN IF EXISTS "lat";
ALTER TABLE "FarmArea" DROP COLUMN IF EXISTS "lng";
ALTER TABLE "FarmArea" DROP COLUMN IF EXISTS "radiusM";


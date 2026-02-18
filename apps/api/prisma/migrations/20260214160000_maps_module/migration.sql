-- Maps module: farm areas / loot locations

CREATE TABLE IF NOT EXISTS "FarmMap" (
  "map_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "centerLat" DOUBLE PRECISION NOT NULL,
  "centerLng" DOUBLE PRECISION NOT NULL,
  "zoom" INTEGER NOT NULL DEFAULT 12,
  "tileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FarmMap_pkey" PRIMARY KEY ("map_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FarmMap_slug_key" ON "FarmMap"("slug");

CREATE TABLE IF NOT EXISTS "FarmArea" (
  "area_id" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "itemType" TEXT,
  "itemRef" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "radiusM" INTEGER NOT NULL DEFAULT 120,
  "color" TEXT NOT NULL DEFAULT 'red',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FarmArea_pkey" PRIMARY KEY ("area_id")
);

CREATE INDEX IF NOT EXISTS "FarmArea_mapId_idx" ON "FarmArea"("mapId");

ALTER TABLE "FarmArea"
ADD CONSTRAINT "FarmArea_mapId_fkey"
FOREIGN KEY ("mapId") REFERENCES "FarmMap"("map_id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure root/admin profiles can manage maps after migration (safe on re-run)
UPDATE "AccessProfile"
SET "permissions" = array_append("permissions", 'admin.maps.manage'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('root', 'admin')
  AND NOT ('admin.maps.manage' = ANY("permissions"));

-- Seed a default map (approximate Washington DC)
INSERT INTO "FarmMap" ("map_id","slug","name","centerLat","centerLng","zoom","updatedAt")
VALUES ('MAP_DC', 'dc', 'Washington, D.C.', 38.9072, -77.0369, 12, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

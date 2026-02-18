-- Structured storage for gear core/minor stats and gear mods.

CREATE TABLE IF NOT EXISTS "GearItemStat" (
  "stat_id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" TEXT,
  "unit" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearItemStat_pkey" PRIMARY KEY ("stat_id")
);

CREATE TABLE IF NOT EXISTS "GearItemMod" (
  "mod_id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "GearItemMod_pkey" PRIMARY KEY ("mod_id")
);

CREATE INDEX IF NOT EXISTS "GearItemStat_itemId_idx" ON "GearItemStat"("itemId");
CREATE INDEX IF NOT EXISTS "GearItemStat_kind_idx" ON "GearItemStat"("kind");
CREATE INDEX IF NOT EXISTS "GearItemMod_itemId_idx" ON "GearItemMod"("itemId");

ALTER TABLE "GearItemStat"
ADD CONSTRAINT "GearItemStat_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "GearItem"("item_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearItemMod"
ADD CONSTRAINT "GearItemMod_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "GearItem"("item_id")
ON DELETE CASCADE ON UPDATE CASCADE;

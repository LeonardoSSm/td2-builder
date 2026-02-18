-- CreateTable
CREATE TABLE IF NOT EXISTS "WeaponMod" (
  "weapon_mod_id" TEXT NOT NULL,
  "type" TEXT,
  "slot" TEXT,
  "name" TEXT NOT NULL,
  "bonus" TEXT,
  "penalty" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "patchVersion" TEXT,
  "lastUpdated" TIMESTAMP(3),
  CONSTRAINT "WeaponMod_pkey" PRIMARY KEY ("weapon_mod_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeaponMod_name_key" ON "WeaponMod"("name");
CREATE INDEX IF NOT EXISTS "WeaponMod_type_idx" ON "WeaponMod"("type");
CREATE INDEX IF NOT EXISTS "WeaponMod_slot_idx" ON "WeaponMod"("slot");


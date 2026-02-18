-- Enums + constraints + indexes for data consistency and performance.
-- Note: Prisma can't express functional/trigram indexes, so we enforce them at the DB level.

-- 1) Normalize existing values (safe no-ops if already normalized)
UPDATE "Attribute" SET "unit" = 'PERCENT' WHERE "unit" = '%' OR lower("unit") = 'percent';
UPDATE "Attribute" SET "unit" = 'FLAT' WHERE lower("unit") = 'flat';

UPDATE "GearItemStat" SET "kind" = 'CORE' WHERE lower("kind") = 'core';
UPDATE "GearItemStat" SET "kind" = 'MINOR' WHERE lower("kind") = 'minor';

-- Slot normalization with common synonyms/variants (including PT-BR).
UPDATE "GearItem"
SET "slot" = CASE
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('mask','mascara','mascaras') THEN 'Mask'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('chest','vest','colete') THEN 'Chest'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('backpack','mochila') THEN 'Backpack'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('gloves','luvas','luva') THEN 'Gloves'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('holster','coldre') THEN 'Holster'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('kneepads','kneepad','knees','knee','joelheira','joelheiras') THEN 'Kneepads'
  ELSE initcap(lower("slot"))
END
WHERE "slot" IS NOT NULL;

UPDATE "BuildSlot"
SET "slot" = CASE
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('mask','mascara','mascaras') THEN 'Mask'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('chest','vest','colete') THEN 'Chest'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('backpack','mochila') THEN 'Backpack'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('gloves','luvas','luva') THEN 'Gloves'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('holster','coldre') THEN 'Holster'
  WHEN replace(translate(lower("slot"), 'áàãâéêíóôõúç', 'aaaaeeiooouc'), ' ', '') IN ('kneepads','kneepad','knees','knee','joelheira','joelheiras') THEN 'Kneepads'
  ELSE initcap(lower("slot"))
END
WHERE "slot" IS NOT NULL;

UPDATE "GearItem" SET "coreColor" = initcap(lower("coreColor")) WHERE "coreColor" IS NOT NULL;
UPDATE "RecommendedBuildProfile" SET "preferredCore" = initcap(lower("preferredCore")) WHERE "preferredCore" IS NOT NULL;

-- TalentType has a special casing for GearSet.
UPDATE "Talent"
SET "type" = CASE
  WHEN lower("type") = 'weapon' THEN 'Weapon'
  WHEN lower("type") = 'chest' THEN 'Chest'
  WHEN lower("type") = 'backpack' THEN 'Backpack'
  WHEN replace(lower("type"), ' ', '') = 'gearset' THEN 'GearSet'
  ELSE "type"
END
WHERE "type" IS NOT NULL;
UPDATE "Attribute" SET "category" = initcap(lower("category")) WHERE "category" IS NOT NULL;

-- Weapon class is stored in various formats in spreadsheets; keep known canonical forms.
UPDATE "Weapon" SET "class" = 'AR' WHERE lower("class") IN ('ar', 'assault rifle', 'assault rifles');
UPDATE "Weapon" SET "class" = 'SMG' WHERE lower("class") IN ('smg', 'submachine gun', 'submachine guns');
UPDATE "Weapon" SET "class" = 'LMG' WHERE lower("class") IN ('lmg', 'light machine gun', 'light machine guns');
UPDATE "Weapon" SET "class" = 'MMR' WHERE lower("class") IN ('mmr', 'marksman rifle', 'marksman rifles');
UPDATE "Weapon" SET "class" = 'Rifle' WHERE lower("class") IN ('rifle', 'rifles');
UPDATE "Weapon" SET "class" = 'Shotgun' WHERE lower("class") IN ('shotgun', 'shotguns');
UPDATE "Weapon" SET "class" = 'Pistol' WHERE lower("class") IN ('pistol', 'pistols');

-- Rarity has special casing for HighEnd and GearSet.
UPDATE "Weapon"
SET "rarity" = CASE
  WHEN replace(lower("rarity"), ' ', '') = 'highend' THEN 'HighEnd'
  WHEN lower("rarity") = 'named' THEN 'Named'
  WHEN lower("rarity") = 'exotic' THEN 'Exotic'
  ELSE "rarity"
END
WHERE "rarity" IS NOT NULL;

UPDATE "GearItem"
SET "rarity" = CASE
  WHEN replace(lower("rarity"), ' ', '') = 'highend' THEN 'HighEnd'
  WHEN lower("rarity") = 'named' THEN 'Named'
  WHEN lower("rarity") = 'exotic' THEN 'Exotic'
  WHEN replace(lower("rarity"), ' ', '') = 'gearset' THEN 'GearSet'
  ELSE "rarity"
END
WHERE "rarity" IS NOT NULL;

-- Keep canonical casing for enum values (DPS must stay all-caps).
UPDATE "RecommendedBuildProfile"
SET "focus" = CASE
  WHEN lower("focus") = 'dps' THEN 'DPS'
  WHEN lower("focus") = 'tank' THEN 'Tank'
  WHEN lower("focus") = 'skill' THEN 'Skill'
  ELSE "focus"
END
WHERE "focus" IS NOT NULL;

-- 2) Deduplicate natural identifiers before adding unique indexes.
-- Brand.name (case-insensitive)
WITH ranked AS (
  SELECT
    "brand_id" AS id,
    lower("name") AS k,
    row_number() OVER (PARTITION BY lower("name") ORDER BY "brand_id") AS rn,
    first_value("brand_id") OVER (PARTITION BY lower("name") ORDER BY "brand_id") AS keep_id
  FROM "Brand"
)
UPDATE "GearItem" gi
SET "brandId" = r.keep_id
FROM ranked r
WHERE gi."brandId" = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    "brand_id" AS id,
    lower("name") AS k,
    row_number() OVER (PARTITION BY lower("name") ORDER BY "brand_id") AS rn
  FROM "Brand"
)
DELETE FROM "Brand" b
USING ranked r
WHERE b."brand_id" = r.id AND r.rn > 1;

-- Attribute.name (case-insensitive)
WITH ranked AS (
  SELECT
    "attr_id" AS id,
    lower("name") AS k,
    row_number() OVER (PARTITION BY lower("name") ORDER BY "attr_id") AS rn,
    first_value("attr_id") OVER (PARTITION BY lower("name") ORDER BY "attr_id") AS keep_id
  FROM "Attribute"
)
UPDATE "ItemAttrRule" r
SET "attrId" = x.keep_id
FROM ranked x
WHERE r."attrId" = x.id AND x.rn > 1;

WITH ranked AS (
  SELECT
    "attr_id" AS id,
    lower("name") AS k,
    row_number() OVER (PARTITION BY lower("name") ORDER BY "attr_id") AS rn
  FROM "Attribute"
)
DELETE FROM "Attribute" a
USING ranked r
WHERE a."attr_id" = r.id AND r.rn > 1;

-- Talent (type + name case-insensitive)
WITH ranked AS (
  SELECT
    "talent_id" AS id,
    "type" AS t,
    lower("name") AS k,
    row_number() OVER (PARTITION BY "type", lower("name") ORDER BY "talent_id") AS rn,
    first_value("talent_id") OVER (PARTITION BY "type", lower("name") ORDER BY "talent_id") AS keep_id
  FROM "Talent"
)
UPDATE "GearItem" gi
SET "talentId" = r.keep_id
FROM ranked r
WHERE gi."talentId" = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    "talent_id" AS id,
    "type" AS t,
    lower("name") AS k,
    row_number() OVER (PARTITION BY "type", lower("name") ORDER BY "talent_id") AS rn,
    first_value("talent_id") OVER (PARTITION BY "type", lower("name") ORDER BY "talent_id") AS keep_id
  FROM "Talent"
)
UPDATE "Weapon" w
SET "talentId" = r.keep_id
FROM ranked r
WHERE w."talentId" = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    "talent_id" AS id,
    "type" AS t,
    lower("name") AS k,
    row_number() OVER (PARTITION BY "type", lower("name") ORDER BY "talent_id") AS rn
  FROM "Talent"
)
DELETE FROM "Talent" t
USING ranked r
WHERE t."talent_id" = r.id AND r.rn > 1;

-- 3) Create enum types
DO $$ BEGIN
  CREATE TYPE "GearSlot" AS ENUM ('Mask','Chest','Backpack','Gloves','Holster','Kneepads');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearRarity" AS ENUM ('HighEnd','Named','Exotic','GearSet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CoreColor" AS ENUM ('Red','Blue','Yellow');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WeaponClass" AS ENUM ('AR','SMG','LMG','Rifle','MMR','Shotgun','Pistol');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WeaponRarity" AS ENUM ('HighEnd','Named','Exotic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TalentType" AS ENUM ('Weapon','Chest','Backpack','GearSet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttributeCategory" AS ENUM ('Offensive','Defensive','Utility');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttributeUnit" AS ENUM ('PERCENT','FLAT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemStatKind" AS ENUM ('CORE','MINOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecommendedFocus" AS ENUM ('DPS','Tank','Skill');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Alter columns to enums
ALTER TABLE "Talent" ALTER COLUMN "type" TYPE "TalentType" USING ("type"::text::"TalentType");
ALTER TABLE "Attribute" ALTER COLUMN "category" TYPE "AttributeCategory" USING ("category"::text::"AttributeCategory");
ALTER TABLE "Attribute" ALTER COLUMN "unit" TYPE "AttributeUnit" USING ("unit"::text::"AttributeUnit");

ALTER TABLE "GearItem" ALTER COLUMN "slot" TYPE "GearSlot" USING ("slot"::text::"GearSlot");
ALTER TABLE "GearItem" ALTER COLUMN "rarity" TYPE "GearRarity" USING ("rarity"::text::"GearRarity");
ALTER TABLE "GearItem" ALTER COLUMN "coreColor" TYPE "CoreColor" USING ("coreColor"::text::"CoreColor");

ALTER TABLE "GearItemStat" ALTER COLUMN "kind" TYPE "GearItemStatKind" USING ("kind"::text::"GearItemStatKind");

ALTER TABLE "Weapon" ALTER COLUMN "class" TYPE "WeaponClass" USING ("class"::text::"WeaponClass");
ALTER TABLE "Weapon" ALTER COLUMN "rarity" TYPE "WeaponRarity" USING ("rarity"::text::"WeaponRarity");

ALTER TABLE "BuildSlot" ALTER COLUMN "slot" TYPE "GearSlot" USING ("slot"::text::"GearSlot");

ALTER TABLE "RecommendedBuildProfile" ALTER COLUMN "focus" TYPE "RecommendedFocus" USING ("focus"::text::"RecommendedFocus");
ALTER TABLE "RecommendedBuildProfile" ALTER COLUMN "preferredCore" TYPE "CoreColor" USING ("preferredCore"::text::"CoreColor");

-- 5) Constraints / uniques (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_name_ci_key" ON "Brand" (lower("name"));
-- GearSet name CI unique already exists in 20260214140000_gearset_name_ci_unique
CREATE UNIQUE INDEX IF NOT EXISTS "Talent_type_name_ci_key" ON "Talent" ("type", lower("name"));
CREATE UNIQUE INDEX IF NOT EXISTS "Attribute_name_ci_key" ON "Attribute" (lower("name"));

-- 6) Performance indexes
CREATE INDEX IF NOT EXISTS "Build_owner_updatedAt_idx" ON "Build" ("ownerUserId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "GearItem_slot_rarity_idx" ON "GearItem" ("slot", "rarity");
CREATE INDEX IF NOT EXISTS "Weapon_class_rarity_idx" ON "Weapon" ("class", "rarity");

-- 7) Trigram search indexes (for contains/ILIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "GearItem_name_trgm_idx" ON "GearItem" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Weapon_name_trgm_idx" ON "Weapon" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Talent_name_trgm_idx" ON "Talent" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Brand_name_trgm_idx" ON "Brand" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GearSet_name_trgm_idx" ON "GearSet" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Attribute_name_trgm_idx" ON "Attribute" USING gin (lower("name") gin_trgm_ops);

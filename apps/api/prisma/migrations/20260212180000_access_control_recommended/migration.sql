-- Access control (users/profiles/permissions)
CREATE TABLE IF NOT EXISTS "AccessProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccessUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "profileId" TEXT NOT NULL,
  CONSTRAINT "AccessUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessUser_email_key" ON "AccessUser"("email");
CREATE INDEX IF NOT EXISTS "AccessUser_profileId_idx" ON "AccessUser"("profileId");

ALTER TABLE "AccessUser"
ADD CONSTRAINT "AccessUser_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AccessProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recommended builds (admin-managed)
CREATE TABLE IF NOT EXISTS "RecommendedBuildProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "focus" TEXT NOT NULL,
  "preferredCore" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  "setHints" TEXT[] NOT NULL,
  "brandHints" TEXT[] NOT NULL,
  "primaryWeaponHints" TEXT[] NOT NULL,
  "secondaryWeaponHints" TEXT[] NOT NULL,
  "slotOverrides" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendedBuildProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecommendedBuildProfile_enabled_idx" ON "RecommendedBuildProfile"("enabled");
CREATE INDEX IF NOT EXISTS "RecommendedBuildProfile_order_idx" ON "RecommendedBuildProfile"("order");

-- Seed defaults (safe on re-run)
INSERT INTO "AccessProfile" ("id", "name", "permissions", "updatedAt")
VALUES (
  'root',
  'Root',
  ARRAY['admin.items.manage','admin.import.run','admin.recommended.manage','admin.users.manage']::TEXT[],
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AccessProfile" ("id", "name", "permissions", "updatedAt")
VALUES (
  'admin',
  'Admin',
  ARRAY['admin.items.manage','admin.import.run','admin.recommended.manage']::TEXT[],
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AccessUser" ("id", "name", "email", "active", "profileId", "updatedAt")
VALUES (
  'root',
  'Root',
  'root@local.test',
  TRUE,
  'root',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RecommendedBuildProfile"
  ("id","name","description","focus","preferredCore","enabled","order","setHints","brandHints","primaryWeaponHints","secondaryWeaponHints","updatedAt")
VALUES
  ('striker_dps','Striker DPS','Foco em dano sustentado para PvE.','DPS','Red',TRUE,10,ARRAY['striker']::TEXT[],ARRAY['grupo sombra','ceska','fenris','providence']::TEXT[],ARRAY['AR','LMG']::TEXT[],ARRAY['SMG','Shotgun']::TEXT[],CURRENT_TIMESTAMP),
  ('armor_regen_tank','Armor Regen Tank','Alta sobrevivencia com foco em armadura e regen.','Tank','Blue',TRUE,20,ARRAY['foundry','future initiative']::TEXT[],ARRAY['belstone','gila','badger']::TEXT[],ARRAY['Shotgun','LMG']::TEXT[],ARRAY['SMG','Pistol']::TEXT[],CURRENT_TIMESTAMP),
  ('skill_damage','Skill Damage','Foco em dano de habilidade e uptime de skill.','Skill','Yellow',TRUE,30,ARRAY['rigger','future initiative','hard wired']::TEXT[],ARRAY['hana','wyvern','empress']::TEXT[],ARRAY['AR','Rifle']::TEXT[],ARRAY['SMG','Pistol']::TEXT[],CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

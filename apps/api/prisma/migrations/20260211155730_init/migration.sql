-- CreateTable
CREATE TABLE "Source" (
    "source_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "lastUpdated" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("source_id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonus1" TEXT,
    "bonus2" TEXT,
    "bonus3" TEXT,
    "wikiUrl" TEXT,
    "logoUrl" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("brand_id")
);

-- CreateTable
CREATE TABLE "GearSet" (
    "set_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonus2" TEXT,
    "bonus3" TEXT,
    "bonus4" TEXT,
    "wikiUrl" TEXT,
    "logoUrl" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "GearSet_pkey" PRIMARY KEY ("set_id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "talent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "cooldownS" INTEGER,
    "conditions" TEXT,
    "wikiUrl" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("talent_id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "attr_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("attr_id")
);

-- CreateTable
CREATE TABLE "GearItem" (
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "brandId" TEXT,
    "setId" TEXT,
    "isNamed" BOOLEAN NOT NULL DEFAULT false,
    "isExotic" BOOLEAN NOT NULL DEFAULT false,
    "coreColor" TEXT,
    "coreCount" INTEGER,
    "modSlots" INTEGER,
    "talentId" TEXT,
    "imageUrl" TEXT,
    "wikiUrl" TEXT,
    "targetLootRef" TEXT,
    "notes" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "ItemAttrRule" (
    "rule_id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "attrId" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "minValue" TEXT,
    "maxValue" TEXT,
    "notes" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "ItemAttrRule_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "Weapon" (
    "weapon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "isNamed" BOOLEAN NOT NULL DEFAULT false,
    "isExotic" BOOLEAN NOT NULL DEFAULT false,
    "baseDamage" TEXT,
    "rpm" INTEGER,
    "magSize" INTEGER,
    "talentId" TEXT,
    "imageUrl" TEXT,
    "wikiUrl" TEXT,
    "targetLootRef" TEXT,
    "notes" TEXT,
    "patchVersion" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "Weapon_pkey" PRIMARY KEY ("weapon_id")
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "patchVersion" TEXT,
    "primaryWeaponId" TEXT,
    "secondaryWeaponId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildSlot" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemId" TEXT,

    CONSTRAINT "BuildSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetLootLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "locationType" TEXT,
    "locationName" TEXT,
    "targetLootRef" TEXT,
    "targetLootName" TEXT,
    "sourceUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "TargetLootLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GearItem_slot_idx" ON "GearItem"("slot");

-- CreateIndex
CREATE INDEX "GearItem_rarity_idx" ON "GearItem"("rarity");

-- CreateIndex
CREATE INDEX "GearItem_brandId_idx" ON "GearItem"("brandId");

-- CreateIndex
CREATE INDEX "GearItem_setId_idx" ON "GearItem"("setId");

-- CreateIndex
CREATE INDEX "ItemAttrRule_itemId_idx" ON "ItemAttrRule"("itemId");

-- CreateIndex
CREATE INDEX "ItemAttrRule_attrId_idx" ON "ItemAttrRule"("attrId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildSlot_buildId_slot_key" ON "BuildSlot"("buildId", "slot");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearSet" ADD CONSTRAINT "GearSet_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("brand_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "GearSet"("set_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("talent_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttrRule" ADD CONSTRAINT "ItemAttrRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GearItem"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttrRule" ADD CONSTRAINT "ItemAttrRule_attrId_fkey" FOREIGN KEY ("attrId") REFERENCES "Attribute"("attr_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttrRule" ADD CONSTRAINT "ItemAttrRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weapon" ADD CONSTRAINT "Weapon_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("talent_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weapon" ADD CONSTRAINT "Weapon_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSlot" ADD CONSTRAINT "BuildSlot_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSlot" ADD CONSTRAINT "BuildSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GearItem"("item_id") ON DELETE SET NULL ON UPDATE CASCADE;

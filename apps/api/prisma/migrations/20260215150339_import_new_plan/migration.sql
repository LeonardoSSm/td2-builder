-- CreateTable
CREATE TABLE "SkillFamily" (
    "skill_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "availability" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillFamily_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "SkillVariant" (
    "skill_variant_id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "availability" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillVariant_pkey" PRIMARY KEY ("skill_variant_id")
);

-- CreateTable
CREATE TABLE "SkillVariantStat" (
    "skill_stat_id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "stat" TEXT NOT NULL,
    "tier0" TEXT,
    "tier1" TEXT,
    "tier2" TEXT,
    "tier3" TEXT,
    "tier4" TEXT,
    "tier5" TEXT,
    "tier6" TEXT,
    "overchargeStats" TEXT,
    "overchargeEffects" TEXT,
    "expertiseGrades" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillVariantStat_pkey" PRIMARY KEY ("skill_stat_id")
);

-- CreateTable
CREATE TABLE "Specialization" (
    "spec_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("spec_id")
);

-- CreateTable
CREATE TABLE "SpecializationNode" (
    "spec_node_id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "group" TEXT,
    "kind" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecializationNode_pkey" PRIMARY KEY ("spec_node_id")
);

-- CreateTable
CREATE TABLE "CommunityBuildGuide" (
    "guide_id" TEXT NOT NULL,
    "type" TEXT,
    "name" TEXT NOT NULL,
    "author" TEXT,
    "updatedRaw" TEXT,
    "link" TEXT,
    "outline" TEXT,
    "sourceSheet" TEXT NOT NULL DEFAULT 'Hub (Builds)',
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityBuildGuide_pkey" PRIMARY KEY ("guide_id")
);

-- CreateTable
CREATE TABLE "CommunityFaq" (
    "faq_id" TEXT NOT NULL,
    "group" TEXT,
    "type" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "comments" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sourceSheet" TEXT NOT NULL DEFAULT 'FAQ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityFaq_pkey" PRIMARY KEY ("faq_id")
);

-- CreateTable
CREATE TABLE "CommunityCredit" (
    "credit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobDescription" TEXT,
    "contactInfo" TEXT,
    "notes" TEXT,
    "sourceSheet" TEXT NOT NULL DEFAULT 'Credits+admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityCredit_pkey" PRIMARY KEY ("credit_id")
);

-- CreateTable
CREATE TABLE "SpreadsheetDumpRow" (
    "dump_id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpreadsheetDumpRow_pkey" PRIMARY KEY ("dump_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillFamily_name_key" ON "SkillFamily"("name");

-- CreateIndex
CREATE INDEX "SkillVariant_familyId_idx" ON "SkillVariant"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVariant_familyId_name_key" ON "SkillVariant"("familyId", "name");

-- CreateIndex
CREATE INDEX "SkillVariantStat_variantId_idx" ON "SkillVariantStat"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_name_key" ON "Specialization"("name");

-- CreateIndex
CREATE INDEX "SpecializationNode_specId_idx" ON "SpecializationNode"("specId");

-- CreateIndex
CREATE INDEX "CommunityBuildGuide_type_idx" ON "CommunityBuildGuide"("type");

-- CreateIndex
CREATE INDEX "CommunityBuildGuide_sourceSheet_idx" ON "CommunityBuildGuide"("sourceSheet");

-- CreateIndex
CREATE INDEX "CommunityFaq_group_idx" ON "CommunityFaq"("group");

-- CreateIndex
CREATE INDEX "CommunityFaq_type_idx" ON "CommunityFaq"("type");

-- CreateIndex
CREATE INDEX "CommunityFaq_sourceSheet_idx" ON "CommunityFaq"("sourceSheet");

-- CreateIndex
CREATE INDEX "CommunityCredit_sourceSheet_idx" ON "CommunityCredit"("sourceSheet");

-- CreateIndex
CREATE INDEX "SpreadsheetDumpRow_sourceKey_sheetName_idx" ON "SpreadsheetDumpRow"("sourceKey", "sheetName");

-- CreateIndex
CREATE UNIQUE INDEX "SpreadsheetDumpRow_sourceKey_sheetName_rowNumber_key" ON "SpreadsheetDumpRow"("sourceKey", "sheetName", "rowNumber");

-- AddForeignKey
ALTER TABLE "SkillVariant" ADD CONSTRAINT "SkillVariant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "SkillFamily"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVariantStat" ADD CONSTRAINT "SkillVariantStat_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SkillVariant"("skill_variant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecializationNode" ADD CONSTRAINT "SpecializationNode_specId_fkey" FOREIGN KEY ("specId") REFERENCES "Specialization"("spec_id") ON DELETE CASCADE ON UPDATE CASCADE;

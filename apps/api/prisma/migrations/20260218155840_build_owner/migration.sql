-- AlterTable
ALTER TABLE "Build" ADD COLUMN     "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Build_ownerUserId_idx" ON "Build"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "AccessUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

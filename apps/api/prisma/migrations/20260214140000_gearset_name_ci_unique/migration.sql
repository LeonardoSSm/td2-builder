-- Prevent duplicate GearSet names regardless of case.
-- Prisma doesn't model functional indexes, so we enforce it at the DB level.

CREATE UNIQUE INDEX IF NOT EXISTS "GearSet_name_ci_key" ON "GearSet" (lower("name"));

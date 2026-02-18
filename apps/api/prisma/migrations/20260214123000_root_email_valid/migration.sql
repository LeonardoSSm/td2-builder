-- Ensure seeded root user has a syntactically valid email for LoginDto validation.

UPDATE "AccessUser"
SET "email" = 'root@local.test'
WHERE "id" = 'root' AND ("email" IS NULL OR "email" = 'root@local');

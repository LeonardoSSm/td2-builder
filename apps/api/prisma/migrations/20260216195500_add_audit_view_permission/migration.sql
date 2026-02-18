-- Add admin.audit.view permission to root/admin profiles (safe on re-run)
UPDATE "AccessProfile"
SET "permissions" = array_append("permissions", 'admin.audit.view'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('root', 'admin')
  AND NOT ('admin.audit.view' = ANY("permissions"));


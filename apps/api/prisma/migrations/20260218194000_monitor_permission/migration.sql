-- Add monitor permission to existing profiles that already can view audit.
-- This keeps backward compatibility after introducing admin.monitor.view.

UPDATE "AccessProfile"
SET "permissions" = array_append("permissions", 'admin.monitor.view')
WHERE
  NOT ('admin.monitor.view' = ANY("permissions"))
  AND ('admin.audit.view' = ANY("permissions"));


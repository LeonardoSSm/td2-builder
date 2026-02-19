export const PERMISSIONS = [
  "admin.items.manage",
  "admin.import.run",
  "admin.recommended.manage",
  "admin.users.manage",
  "admin.maps.manage",
  "admin.monitor.view",
  "admin.audit.view",
  "ai.chat.use",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

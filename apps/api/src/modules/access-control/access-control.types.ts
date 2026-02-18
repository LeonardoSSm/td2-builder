export const PERMISSIONS = [
  "admin.items.manage",
  "admin.import.run",
  "admin.recommended.manage",
  "admin.users.manage",
  "admin.maps.manage",
  "admin.audit.view",
  "ai.chat.use",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export type AccessProfile = {
  id: string;
  name: string;
  permissions: PermissionKey[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type AccessUser = {
  id: string;
  name: string;
  email?: string;
  profileId: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AccessStore = {
  profiles: AccessProfile[];
  users: AccessUser[];
};

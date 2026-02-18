import type { PermissionKey } from "./permissions";

export type Profile = {
  id: string;
  name: string;
  permissions: PermissionKey[];
};

export type ProfileForm = Omit<Profile, "id">;

export type User = {
  id: string;
  name: string;
  email?: string;
  profileId: string;
  active: boolean;
};

export type UserForm = Omit<User, "id">;

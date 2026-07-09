import type { AppRole, UserProfile } from "./types";

export type Permission =
  | "chat:send"
  | "reports:view"
  | "cases:view"
  | "knowledge:manage"
  | "alerts:view"
  | "tool-jobs:view"
  | "agent-traces:view"
  | "tool-audits:view";

const rolePermissions: Record<AppRole, Permission[]> = {
  student: ["chat:send"],
  admin: [
    "reports:view",
    "cases:view",
    "knowledge:manage",
    "alerts:view",
    "tool-jobs:view",
    "agent-traces:view",
    "tool-audits:view"
  ]
};

export function isAdminProfile(profile: UserProfile | null): boolean {
  return Boolean(profile?.roles.some((role) => role.authority === "ROLE_ADMIN"));
}

export function getProfileRole(profile: UserProfile | null): AppRole | null {
  if (!profile) return null;
  return isAdminProfile(profile) ? "admin" : "student";
}

export function hasRole(profile: UserProfile | null, role: AppRole): boolean {
  return getProfileRole(profile) === role;
}

export function hasPermission(profile: UserProfile | null, permission: Permission): boolean {
  const role = getProfileRole(profile);
  if (!role) return false;
  return rolePermissions[role].includes(permission);
}

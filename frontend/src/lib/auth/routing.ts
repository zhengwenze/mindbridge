import { routes } from "@/lib/config/routes";

import { getProfileRole } from "./permissions";
import type { UserProfile } from "./types";

function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function getDefaultWorkspacePath(profile: UserProfile | null): string {
  return getProfileRole(profile) === "admin" ? routes.admin : routes.student;
}

export function resolvePostLoginPath(profile: UserProfile, redirect: string | null): string {
  const fallback = getDefaultWorkspacePath(profile);
  const role = getProfileRole(profile);

  if (!redirect || !isInternalPath(redirect)) return fallback;
  if (redirect === routes.home || redirect === routes.login || redirect === routes.forbidden) return fallback;
  if (role === "admin" && redirect.startsWith(routes.admin)) return redirect;
  if (role === "student" && redirect.startsWith(routes.student)) return redirect;

  return fallback;
}

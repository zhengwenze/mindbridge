import { queryClient } from "@/lib/query/query-client";
import { useAuthStore } from "@/stores/use-auth-store";

import { routes } from "../config/routes";

export function clearClientAuthState(): void {
  useAuthStore.getState().clearSession();
  queryClient.clear();
}

export function redirectToLogin(): void {
  if (typeof window === "undefined" || window.location.pathname === routes.login) return;

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${routes.login}?redirect=${encodeURIComponent(next)}`);
}

export function handleUnauthorizedSession(): void {
  clearClientAuthState();
  redirectToLogin();
}

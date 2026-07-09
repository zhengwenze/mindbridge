"use client";

import { useRouter } from "next/navigation";

import { clearClientAuthState } from "@/lib/auth/session";
import { routes } from "@/lib/config/routes";

export function useLogout() {
  const router = useRouter();

  return () => {
    clearClientAuthState();
    router.replace(routes.login);
  };
}

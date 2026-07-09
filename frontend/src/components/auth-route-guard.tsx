"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppLoading } from "@/components/layout/app-loading";
import { getProfileRole } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/types";
import { routes } from "@/lib/config/routes";
import { useAuthStore } from "@/stores/use-auth-store";

interface AuthRouteGuardProps {
  allowedRole: AppRole;
  children: React.ReactNode;
}

export function AuthRouteGuard({ allowedRole, children }: AuthRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const profile = useAuthStore((state) => state.profile);
  const role = getProfileRole(profile);

  useEffect(() => {
    if (status === "idle") return;

    if (status === "anonymous") {
      const query = typeof window !== "undefined" ? window.location.search.slice(1) : "";
      const next = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(`${routes.login}?redirect=${encodeURIComponent(next)}`);
      return;
    }

    if (role && role !== allowedRole) {
      router.replace(routes.forbidden);
    }
  }, [allowedRole, pathname, role, router, status]);

  if (status === "idle" || status === "anonymous" || role !== allowedRole) {
    return <AppLoading label="正在检查登录状态" />;
  }

  return <>{children}</>;
}

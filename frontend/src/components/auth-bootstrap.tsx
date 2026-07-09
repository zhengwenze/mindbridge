"use client";

import { useEffect } from "react";

import { fetchProfile } from "@/features/auth/api/auth-api";
import { clearClientAuthState } from "@/lib/auth/session";
import { useAuthStore } from "@/stores/use-auth-store";

export function AuthBootstrap() {
  const initialize = useAuthStore((state) => state.initialize);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let cancelled = false;
    const session = initialize();

    if (!session) return;

    fetchProfile()
      .then((profile) => {
        if (cancelled) return;
        setSession({ token: session.token, profile });
      })
      .catch(() => {
        if (cancelled) return;
        clearClientAuthState();
      });

    return () => {
      cancelled = true;
    };
  }, [initialize, setSession]);

  return null;
}

import { create } from "zustand";

import { clearAuthSession, readAuthSession, writeAuthSession } from "@/lib/auth/token-storage";
import type { AuthSession, UserProfile } from "@/lib/auth/types";

type AuthStatus = "idle" | "anonymous" | "authenticated";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  profile: UserProfile | null;
  initialize: () => AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  token: null,
  profile: null,
  initialize: () => {
    const session = readAuthSession();
    if (!session) {
      set({ status: "anonymous", token: null, profile: null });
      return null;
    }

    set({ status: "idle", token: session.token, profile: session.profile });
    return session;
  },
  setSession: (session) => {
    writeAuthSession(session);
    set({ status: "authenticated", token: session.token, profile: session.profile });
  },
  clearSession: () => {
    clearAuthSession();
    set({ status: "anonymous", token: null, profile: null });
  }
}));

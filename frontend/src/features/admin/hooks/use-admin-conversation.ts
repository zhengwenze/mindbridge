"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchConversation } from "../api/admin-api";
import { adminQueryKeys } from "./use-admin-dashboard";

export function useAdminConversation(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? adminQueryKeys.conversation(sessionId) : ["admin", "conversation", "idle"],
    queryFn: () => fetchConversation(sessionId ?? ""),
    enabled: Boolean(sessionId)
  });
}

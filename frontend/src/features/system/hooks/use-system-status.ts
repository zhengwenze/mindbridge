"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAgentStatus, fetchHealthStatus } from "../api/system-api";

export const systemStatusQueryKeys = {
  health: ["system", "health"] as const,
  agentStatus: ["system", "agent-status"] as const
};

export function useSystemStatus() {
  const healthQuery = useQuery({
    queryKey: systemStatusQueryKeys.health,
    queryFn: fetchHealthStatus,
    refetchInterval: 30_000,
    retry: 1
  });

  const agentStatusQuery = useQuery({
    queryKey: systemStatusQueryKeys.agentStatus,
    queryFn: fetchAgentStatus,
    refetchInterval: 60_000,
    retry: 1
  });

  return {
    healthQuery,
    agentStatusQuery
  };
}

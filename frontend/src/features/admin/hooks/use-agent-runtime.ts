"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { systemStatusQueryKeys } from "@/features/system/hooks/use-system-status";

import {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
} from "../api/admin-api";

export const agentRuntimeQueryKeys = {
  config: ["admin", "agent-runtime"] as const,
};

export function useAgentRuntimeConfig() {
  return useQuery({
    queryKey: agentRuntimeQueryKeys.config,
    queryFn: fetchAgentRuntimeConfig,
  });
}

export function useAgentRuntimeUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAgentRuntimeConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(agentRuntimeQueryKeys.config, config);
      void queryClient.invalidateQueries({
        queryKey: agentRuntimeQueryKeys.config,
      });
      void queryClient.invalidateQueries({
        queryKey: systemStatusQueryKeys.agentStatus,
      });
    },
  });
}

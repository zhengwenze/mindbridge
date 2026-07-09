import { apiClient } from "@/lib/api/api-client";

import type { AgentStatus, HealthStatus } from "../types/system-types";

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await apiClient.get<HealthStatus>("/actuator/health");
  return response.data;
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const response = await apiClient.get<AgentStatus>("/api/agent/status");
  return response.data;
}

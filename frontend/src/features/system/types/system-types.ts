export interface HealthStatus {
  status?: string;
}

export interface AgentStatus {
  provider?: string;
  model?: string;
  realModelEnabled?: boolean;
  agentFramework?: {
    requested?: string;
    active?: string;
    langgraphAvailable?: boolean;
    fallback?: boolean;
  };
}

"use client";

import { Tag, Tooltip } from "antd";

import { useSystemStatus } from "@/features/system/hooks/use-system-status";

function displayModel(model?: string): string {
  if (!model) return "模型未知";
  return model.includes("mindbridge-qwen2.5-7b-ft") ? "微调 Qwen2.5-7B" : model;
}

export function GlobalStatusIndicators() {
  const { healthQuery, agentStatusQuery } = useSystemStatus();
  const healthStatus = healthQuery.data?.status;
  const serviceOk = healthStatus === "UP";
  const agentStatus = agentStatusQuery.data;

  const serviceLabel = healthQuery.isLoading
    ? "服务检测中"
    : serviceOk
      ? "服务正常"
      : healthStatus
        ? `服务 ${healthStatus}`
        : "服务 DOWN";

  const modelLabel = agentStatusQuery.isLoading
    ? "模型读取中"
    : agentStatusQuery.isError
      ? "模型状态未知"
      : agentStatus?.realModelEnabled
        ? `${agentStatus.provider ?? "模型"} / ${displayModel(agentStatus.model)}`
        : "mock 演示";

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Tooltip title={healthQuery.isError ? "无法连接 /actuator/health" : "后端服务状态"}>
        <Tag color={serviceOk ? "success" : healthQuery.isLoading ? "processing" : "error"} className="!m-0">
          {serviceLabel}
        </Tag>
      </Tooltip>
      <Tooltip title={agentStatusQuery.isError ? "无法读取 /api/agent/status" : "Agent 模型状态"}>
        <Tag
          color={
            agentStatusQuery.isLoading
              ? "processing"
              : agentStatusQuery.isError
                ? "warning"
                : agentStatus?.realModelEnabled
                  ? "success"
                  : "warning"
          }
          className="!m-0 max-w-[260px] truncate"
        >
          {modelLabel}
        </Tag>
      </Tooltip>
    </div>
  );
}

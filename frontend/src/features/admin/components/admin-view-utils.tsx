import { Tag } from "antd";

export function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : "暂无时间";
}

export function roleLabel(role?: string): string {
  const value = (role ?? "").toUpperCase();
  if (value === "USER") return "学生";
  if (value === "ASSISTANT") return "MindBridge";
  if (value === "SYSTEM") return "系统";
  return role || "未知角色";
}

export function riskTagColor(riskLevel?: string): string {
  const value = (riskLevel ?? "").toUpperCase();
  if (value === "HIGH") return "error";
  if (value === "MEDIUM") return "warning";
  if (value === "LOW") return "success";
  return "default";
}

export function RiskTag({ riskLevel }: { riskLevel?: string }) {
  return <Tag color={riskTagColor(riskLevel)}>{riskLevel || "UNKNOWN"}</Tag>;
}

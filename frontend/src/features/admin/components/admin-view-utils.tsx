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
  const labels: Record<string, string> = {
    HIGH: "高风险",
    MEDIUM: "中风险",
    LOW: "低风险"
  };
  const normalized = (riskLevel ?? "").toUpperCase();
  return <Tag color={riskTagColor(riskLevel)}>{labels[normalized] ?? riskLevel ?? "未知风险"}</Tag>;
}

export function CaseStatusTag({ status }: { status?: string }) {
  const normalized = (status ?? "").toUpperCase();
  const values: Record<string, { color: string; label: string }> = {
    OPEN: { color: "warning", label: "待跟进" },
    ALERT_SENT: { color: "processing", label: "预警已发送" },
    ACKNOWLEDGED: { color: "success", label: "已确认" }
  };
  const value = values[normalized];
  return <Tag color={value?.color}>{value?.label ?? status ?? "未知状态"}</Tag>;
}

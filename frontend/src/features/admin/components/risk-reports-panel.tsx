"use client";

import { Alert, Card, Empty, List, Skeleton, Typography } from "antd";

import { toApiError } from "@/lib/api/api-error";

import type { RiskReport } from "../types/admin-types";
import { formatDateTime, RiskTag } from "./admin-view-utils";

interface RiskReportsPanelProps {
  reports: RiskReport[];
  loading: boolean;
  error: unknown;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
}

export function RiskReportsPanel({
  reports,
  loading,
  error,
  selectedSessionId,
  onSelectSession
}: RiskReportsPanelProps) {
  if (loading) {
    return (
      <Card title="心理风险与咨询报告" variant="outlined">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (error) {
    const apiError = toApiError(error);
    return (
      <Card title="心理风险与咨询报告" variant="outlined">
        <Alert type="error" showIcon title="报告读取失败" description={apiError.message} />
      </Card>
    );
  }

  return (
    <Card title="心理风险与咨询报告" variant="outlined">
      {reports.length === 0 ? (
        <Empty description="暂无报告，学生咨询或风险场景会在这里沉淀记录" />
      ) : (
        <List
          dataSource={reports}
          renderItem={(item) => {
            const isActive = Boolean(item.sessionId && item.sessionId === selectedSessionId);
            return (
              <List.Item>
                <button
                  type="button"
                  className={`w-full rounded border p-4 text-left transition ${
                    isActive
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                  }`}
                  onClick={() => onSelectSession(item.sessionId ?? null)}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Typography.Text strong>{item.displayName || item.username || "未知学生"}</Typography.Text>
                      <RiskTag riskLevel={item.riskLevel} />
                    </div>
                    <Typography.Text type="secondary">{formatDateTime(item.createdAt)}</Typography.Text>
                  </div>
                  <Typography.Paragraph className="!mb-2">{item.summary || "暂无摘要"}</Typography.Paragraph>
                  <Typography.Text type="secondary" className="block break-words">
                    {item.content || "暂无内容"}
                  </Typography.Text>
                  <span className="mt-2 inline-block font-semibold text-blue-600">
                    查看会话档案
                  </span>
                </button>
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}

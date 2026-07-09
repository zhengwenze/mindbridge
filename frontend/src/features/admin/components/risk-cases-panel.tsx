"use client";

import { Alert, Card, Empty, List, Skeleton, Typography } from "antd";

import { toApiError } from "@/lib/api/api-error";

import type { RiskCase } from "../types/admin-types";
import { formatDateTime, RiskTag } from "./admin-view-utils";

interface RiskCasesPanelProps {
  cases: RiskCase[];
  loading: boolean;
  error: unknown;
}

export function RiskCasesPanel({ cases, loading, error }: RiskCasesPanelProps) {
  if (loading) {
    return (
      <Card title="风险个案闭环" variant="outlined">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (error) {
    const apiError = toApiError(error);
    return (
      <Card title="风险个案闭环" variant="outlined">
        <Alert type="error" showIcon title="个案读取失败" description={apiError.message} />
      </Card>
    );
  }

  return (
    <Card title="风险个案闭环" variant="outlined">
      {cases.length === 0 ? (
        <Empty description="暂无个案，中高风险报告会自动创建风险个案" />
      ) : (
        <List
          dataSource={cases}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Text strong>个案 #{item.id ?? "未知"}</Typography.Text>
                    <Typography.Text type="secondary">{item.status ?? "未设置状态"}</Typography.Text>
                    <RiskTag riskLevel={item.riskLevel} />
                  </div>
                }
                description={
                  <div className="grid gap-2">
                    <Typography.Text type="secondary">
                      报告 #{item.reportId ?? "未知"} · 负责人 {item.owner || "未分配"} ·{" "}
                      {formatDateTime(item.updatedAt)}
                    </Typography.Text>
                    <Typography.Paragraph className="!mb-0">{item.summary || "暂无摘要"}</Typography.Paragraph>
                    {item.handoffSummary ? (
                      <pre className="m-0 whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                        {item.handoffSummary}
                      </pre>
                    ) : null}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

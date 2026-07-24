"use client";

import { Alert, Card, Empty, Pagination, Skeleton, Typography } from "antd";

import { toApiError } from "@/lib/api/api-error";

import type { RiskCase } from "../types/admin-types";
import { CaseStatusTag, formatDateTime, RiskTag } from "./admin-view-utils";

interface RiskCasesPanelProps {
  cases: RiskCase[];
  total: number;
  page: number;
  loading: boolean;
  error: unknown;
  pageSize?: number;
  title?: string;
  description?: string;
  emptyDescription?: string;
  onPageChange: (page: number) => void;
}

export function RiskCasesPanel({
  cases,
  total,
  page,
  loading,
  error,
  pageSize = 20,
  title = "风险个案",
  description = "按更新时间查看需要跟进的风险个案。",
  emptyDescription = "暂无风险个案",
  onPageChange
}: RiskCasesPanelProps) {
  if (loading) {
    return (
      <Card title={title} variant="outlined">
        <Skeleton active paragraph={{ rows: Math.min(pageSize, 5) }} />
      </Card>
    );
  }

  if (error) {
    const apiError = toApiError(error);
    return (
      <Card title={title} variant="outlined">
        <Alert type="error" showIcon title="个案读取失败" description={apiError.message} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <div>
          <Typography.Title level={4} className="!mb-0">
            {title}
          </Typography.Title>
          <Typography.Text type="secondary" className="!text-xs">
            {description}
          </Typography.Text>
        </div>
      }
      extra={total > 0 ? <Typography.Text type="secondary">共 {total} 条</Typography.Text> : null}
      variant="outlined"
    >
      {cases.length === 0 ? (
        <Empty description={emptyDescription} />
      ) : (
        <>
          <ul className="m-0 list-none divide-y divide-slate-200 p-0">
            {cases.map((item, index) => (
              <li key={item.id ?? `${item.reportId ?? "case"}-${index}`} className="py-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Text strong>个案 #{item.id ?? "未知"}</Typography.Text>
                    <RiskTag riskLevel={item.riskLevel} />
                    <CaseStatusTag status={item.status} />
                  </div>
                  <Typography.Text type="secondary">
                    报告 #{item.reportId ?? "未知"} · 负责人 {item.owner || "未分配"} · {formatDateTime(item.updatedAt)}
                  </Typography.Text>
                  <Typography.Paragraph className="!mb-0">{item.summary || "暂无摘要"}</Typography.Paragraph>
                  {item.handoffSummary ? (
                    <pre className="m-0 whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {item.handoffSummary}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {total > pageSize ? (
            <div className="mt-4 flex justify-end">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger={false}
                showQuickJumper={total > pageSize * 3}
                onChange={onPageChange}
                showTotal={(total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`}
              />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

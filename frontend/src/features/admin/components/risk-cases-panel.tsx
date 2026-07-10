"use client";

import { Alert, Card, Empty, Pagination, Skeleton, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import type { RiskCase } from "../types/admin-types";
import { formatDateTime, RiskTag } from "./admin-view-utils";

interface RiskCasesPanelProps {
  cases: RiskCase[];
  loading: boolean;
  error: unknown;
  pageSize?: number;
  title?: string;
  description?: string;
}

export function RiskCasesPanel({
  cases,
  loading,
  error,
  pageSize = 5,
  title = "风险个案",
  description = "按更新时间查看需要跟进的风险个案，单页最多展示 5 条。"
}: RiskCasesPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(cases.length / pageSize));
    setCurrentPage((page) => Math.min(page, lastPage));
  }, [cases.length, pageSize]);

  const visibleCases = useMemo(
    () => cases.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [cases, currentPage, pageSize]
  );

  if (loading) {
    return (
      <Card title={title} variant="outlined">
        <Skeleton active paragraph={{ rows: pageSize }} />
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
      extra={cases.length > 0 ? <Typography.Text type="secondary">共 {cases.length} 条</Typography.Text> : null}
      variant="outlined"
    >
      {cases.length === 0 ? (
        <Empty description="暂无个案，中高风险报告会自动创建风险个案" />
      ) : (
        <>
          <ul className="m-0 list-none divide-y divide-slate-200 p-0">
            {visibleCases.map((item, index) => (
              <li key={item.id ?? `${item.reportId ?? "case"}-${index}`} className="py-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Text strong>个案 #{item.id ?? "未知"}</Typography.Text>
                    <Typography.Text type="secondary">{item.status ?? "未设置状态"}</Typography.Text>
                    <RiskTag riskLevel={item.riskLevel} />
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
          {cases.length > pageSize ? (
            <div className="mt-4 flex justify-end">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={cases.length}
                showSizeChanger={false}
                showQuickJumper={cases.length > pageSize * 3}
                onChange={setCurrentPage}
                showTotal={(total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`}
              />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

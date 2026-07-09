"use client";

import { Alert, Button, Space } from "antd";
import { useState } from "react";

import { PageContainer } from "@/components/layout/page-container";

import { useAdminConversation } from "../hooks/use-admin-conversation";
import { useAdminDashboard } from "../hooks/use-admin-dashboard";
import { AdminMetrics } from "./admin-metrics";
import { ConversationArchivePanel } from "./conversation-archive-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";
import { RiskCasesPanel } from "./risk-cases-panel";
import { RiskReportsPanel } from "./risk-reports-panel";

export function AdminDashboard() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [missingSession, setMissingSession] = useState(false);
  const dashboard = useAdminDashboard();
  const conversationQuery = useAdminConversation(selectedSessionId);
  const dashboardLoading =
    dashboard.reportsQuery.isLoading ||
    dashboard.casesQuery.isLoading ||
    dashboard.excelRecordsQuery.isLoading ||
    dashboard.alertsQuery.isLoading;

  function handleSelectSession(sessionId: string | null) {
    setSelectedSessionId(sessionId);
    setMissingSession(!sessionId);
  }

  function handleRefresh() {
    dashboard.reportsQuery.refetch();
    dashboard.casesQuery.refetch();
    dashboard.excelRecordsQuery.refetch();
    dashboard.alertsQuery.refetch();
    if (selectedSessionId) conversationQuery.refetch();
  }

  const metricErrorCount = [
    dashboard.reportsQuery.error,
    dashboard.casesQuery.error,
    dashboard.excelRecordsQuery.error,
    dashboard.alertsQuery.error
  ].filter(Boolean).length;

  return (
    <PageContainer
      title="管理工作台"
      description="查看风险报告、个案闭环、会话档案和知识库维护状态。"
    >
      <div className="grid gap-4">
        <div className="flex justify-end">
          <Space>
            {metricErrorCount > 0 ? (
              <Alert type="warning" showIcon message={`${metricErrorCount} 个看板接口读取失败`} />
            ) : null}
            <Button onClick={handleRefresh} loading={dashboardLoading}>
              刷新
            </Button>
          </Space>
        </div>

        <AdminMetrics metrics={dashboard.metrics} loading={dashboardLoading} />

        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
          <div className="grid content-start gap-4">
            <RiskCasesPanel
              cases={dashboard.cases}
              loading={dashboard.casesQuery.isLoading}
              error={dashboard.casesQuery.error}
            />
            <KnowledgeBasePanel />
          </div>

          <div className="grid content-start gap-4">
            <RiskReportsPanel
              reports={dashboard.reports}
              loading={dashboard.reportsQuery.isLoading}
              error={dashboard.reportsQuery.error}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelectSession}
            />
            <ConversationArchivePanel
              sessionId={selectedSessionId}
              missingSession={missingSession}
              query={conversationQuery}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

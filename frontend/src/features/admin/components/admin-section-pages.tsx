"use client";

import { Alert, Card, Empty, Typography } from "antd";
import { useState } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { toApiError } from "@/lib/api/api-error";

import { useAdminConversation } from "../hooks/use-admin-conversation";
import { useAdminDashboard } from "../hooks/use-admin-dashboard";
import { AdminMetrics } from "./admin-metrics";
import { AdminRecordTable } from "./admin-record-table";
import { ConversationArchivePanel } from "./conversation-archive-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";
import { RiskCasesPanel } from "./risk-cases-panel";
import { RiskReportsPanel } from "./risk-reports-panel";
import { UserManagementPanel } from "./user-management-panel";

function AdminDataError({ errors }: { errors: unknown[] }) {
  const firstError = errors.find(Boolean);
  return firstError ? (
    <Alert
      type="warning"
      showIcon
      title={`${errors.filter(Boolean).length} 个数据接口读取失败`}
      description={toApiError(firstError).message}
    />
  ) : null;
}

export function AdminOverviewPage() {
  const dashboard = useAdminDashboard();
  const loading = [
    dashboard.reportsQuery.isLoading,
    dashboard.casesQuery.isLoading,
    dashboard.excelRecordsQuery.isLoading,
    dashboard.alertsQuery.isLoading
  ].some(Boolean);

  return (
    <PageContainer title="管理概览" hideHeader>
      <div className="grid gap-4">
        <AdminDataError
          errors={[
            dashboard.reportsQuery.error,
            dashboard.casesQuery.error,
            dashboard.excelRecordsQuery.error,
            dashboard.alertsQuery.error
          ]}
        />
        <AdminMetrics metrics={dashboard.metrics} loading={loading} />
        <RiskCasesPanel
          cases={dashboard.cases}
          loading={dashboard.casesQuery.isLoading}
          error={dashboard.casesQuery.error}
          title="待跟进风险个案"
          description="按最近更新时间排列，点击左侧菜单可查看全部个案。"
        />
      </div>
    </PageContainer>
  );
}

export function AdminCasesPage() {
  const dashboard = useAdminDashboard();
  return (
    <PageContainer title="风险个案" hideHeader>
      <RiskCasesPanel
        cases={dashboard.cases}
        loading={dashboard.casesQuery.isLoading}
        error={dashboard.casesQuery.error}
        title="风险个案列表"
      />
    </PageContainer>
  );
}

export function AdminReportsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [missingSession, setMissingSession] = useState(false);
  const dashboard = useAdminDashboard();
  const conversationQuery = useAdminConversation(selectedSessionId);

  function handleSelectSession(sessionId: string | null) {
    setSelectedSessionId(sessionId);
    setMissingSession(!sessionId);
  }

  return (
    <PageContainer title="风险报告" hideHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(0,1.05fr)]">
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
    </PageContainer>
  );
}

export function AdminLedgerPage() {
  const dashboard = useAdminDashboard();
  return (
    <PageContainer title="Excel 台账" hideHeader>
      <AdminRecordTable
        kind="excel"
        records={dashboard.excelRecords}
        loading={dashboard.excelRecordsQuery.isLoading}
        error={dashboard.excelRecordsQuery.error}
      />
    </PageContainer>
  );
}

export function AdminAlertsPage() {
  const dashboard = useAdminDashboard();
  return (
    <PageContainer title="预警记录" hideHeader>
      <AdminRecordTable
        kind="alerts"
        records={dashboard.alerts}
        loading={dashboard.alertsQuery.isLoading}
        error={dashboard.alertsQuery.error}
      />
    </PageContainer>
  );
}

export function AdminKnowledgePage() {
  return (
    <PageContainer title="知识库" hideHeader>
      <KnowledgeBasePanel />
    </PageContainer>
  );
}

export function AdminUsersPage() {
  return (
    <PageContainer title="用户管理" hideHeader>
      <UserManagementPanel />
    </PageContainer>
  );
}

export function AdminSystemStatusPage() {
  return (
    <PageContainer title="系统状态" hideHeader>
      <Card title="知识索引状态" variant="outlined">
        <Typography.Paragraph type="secondary" className="!mb-0">
          请在“知识库”页面打开具体知识库的“管理文档”，查看 collection、向量数量并重建该知识库的索引。
        </Typography.Paragraph>
      </Card>
    </PageContainer>
  );
}

export function AdminEmptyPage() {
  return (
    <PageContainer title="管理后台" hideHeader>
      <Card variant="outlined">
        <Empty description="暂无可用内容" />
      </Card>
    </PageContainer>
  );
}

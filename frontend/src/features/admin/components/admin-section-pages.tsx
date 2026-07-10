"use client";

import { Alert, Card, Empty, Typography } from "antd";
import { useState } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { toApiError } from "@/lib/api/api-error";

import { useAdminConversation } from "../hooks/use-admin-conversation";
import { useAdminDashboard } from "../hooks/use-admin-dashboard";
import { useKnowledgeActions, useKnowledgeStatus } from "../hooks/use-knowledge-actions";
import { AdminMetrics } from "./admin-metrics";
import { AdminRecordTable } from "./admin-record-table";
import { ConversationArchivePanel } from "./conversation-archive-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";
import { RiskCasesPanel } from "./risk-cases-panel";
import { RiskReportsPanel } from "./risk-reports-panel";

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
    <PageContainer
      title="管理概览"
      description="集中查看风险运营数据，快速进入个案、报告和预警处理。"
    >
      <div className="grid gap-5">
        <AdminDataError
          errors={[
            dashboard.reportsQuery.error,
            dashboard.casesQuery.error,
            dashboard.excelRecordsQuery.error,
            dashboard.alertsQuery.error
          ]}
        />
        <AdminMetrics metrics={dashboard.metrics} loading={loading} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <RiskCasesPanel
            cases={dashboard.cases}
            loading={dashboard.casesQuery.isLoading}
            error={dashboard.casesQuery.error}
            title="待跟进风险个案"
            description="按最近更新时间排列，点击左侧菜单可查看全部个案。"
          />
          <Card title="后台使用提示" variant="outlined" className="h-fit">
            <div className="grid gap-4">
              <div>
                <Typography.Text strong>先看高风险，再看预警状态</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
                  高风险报告会自动进入风险个案；预警记录用于确认通知是否已成功送达。
                </Typography.Paragraph>
              </div>
              <div>
                <Typography.Text strong>报告支持会话回溯</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
                  在“风险报告”中选择报告，即可只读查看对应的历史会话档案。
                </Typography.Paragraph>
              </div>
              <div>
                <Typography.Text strong>数据范围</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
                  看板统计当前接口返回的最近 100 条记录，详情页提供分页浏览。
                </Typography.Paragraph>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export function AdminCasesPage() {
  const dashboard = useAdminDashboard();
  return (
    <PageContainer title="风险个案" description="按风险等级和更新时间审阅已有个案，单页最多展示 5 条记录。">
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
    <PageContainer title="风险报告" description="查看心理风险与咨询报告，并回溯对应会话档案。">
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
    <PageContainer title="Excel 台账" description="查看风险报告写入 Excel 台账的记录和处理结果。">
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
    <PageContainer title="预警记录" description="查看高风险场景触发的通知渠道、接收方和发送状态。">
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
    <PageContainer title="知识库" description="维护心理支持知识库，为 MindBridge 的回答和风险判断提供依据。">
      <KnowledgeBasePanel />
    </PageContainer>
  );
}

export function AdminSystemStatusPage() {
  const statusQuery = useKnowledgeStatus();
  const { rebuildMutation, backupMutation } = useKnowledgeActions();

  return (
    <PageContainer title="系统状态" description="查看知识索引状态和后台基础设施运行情况。">
      <Card title="知识索引状态" variant="outlined">
        {statusQuery.isLoading ? <Typography.Text type="secondary">正在读取状态…</Typography.Text> : null}
        {statusQuery.error ? <Alert type="error" showIcon description={toApiError(statusQuery.error).message} /> : null}
        {statusQuery.data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusValue label="数据库片段" value={statusQuery.data.databaseChunks ?? 0} />
            <StatusValue label="向量索引" value={statusQuery.data.vectorAvailable ? "可用" : "不可用"} />
            <StatusValue label="向量片段" value={statusQuery.data.vectorChunks ?? 0} />
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
          >
            {rebuildMutation.isPending ? "重建中…" : "重建向量索引"}
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
          >
            {backupMutation.isPending ? "备份中…" : "备份向量索引"}
          </button>
        </div>
      </Card>
    </PageContainer>
  );
}

function StatusValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <Typography.Text type="secondary" className="block !text-xs">
        {label}
      </Typography.Text>
      <Typography.Title level={4} className="!mb-0 !mt-1">
        {value}
      </Typography.Title>
    </div>
  );
}

export function AdminEmptyPage() {
  return (
    <PageContainer title="管理后台" description="该功能正在准备中。">
      <Card variant="outlined">
        <Empty description="暂无可用内容" />
      </Card>
    </PageContainer>
  );
}

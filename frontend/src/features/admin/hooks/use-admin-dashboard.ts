"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAdminCases, fetchAdminReports, fetchAlerts, fetchExcelRecords } from "../api/admin-api";

export const adminQueryKeys = {
  reports: ["admin", "reports"] as const,
  cases: ["admin", "cases"] as const,
  excelRecords: ["admin", "excel-records"] as const,
  alerts: ["admin", "alerts"] as const,
  conversation: (sessionId: string) => ["admin", "conversation", sessionId] as const,
  knowledgeStatus: ["admin", "knowledge-status"] as const
};

export function useAdminDashboard() {
  const reportsQuery = useQuery({
    queryKey: adminQueryKeys.reports,
    queryFn: fetchAdminReports
  });

  const casesQuery = useQuery({
    queryKey: adminQueryKeys.cases,
    queryFn: fetchAdminCases
  });

  const excelRecordsQuery = useQuery({
    queryKey: adminQueryKeys.excelRecords,
    queryFn: fetchExcelRecords
  });

  const alertsQuery = useQuery({
    queryKey: adminQueryKeys.alerts,
    queryFn: fetchAlerts
  });

  const reports = reportsQuery.data ?? [];
  const cases = casesQuery.data ?? [];
  const excelRecords = excelRecordsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return {
    reports,
    cases,
    excelRecords,
    alerts,
    reportsQuery,
    casesQuery,
    excelRecordsQuery,
    alertsQuery,
    metrics: {
      reportCount: reports.length,
      highRiskCount: reports.filter((item) => item.riskLevel === "HIGH").length,
      caseCount: cases.length,
      excelRecordCount: excelRecords.length,
      alertCount: alerts.length
    }
  };
}

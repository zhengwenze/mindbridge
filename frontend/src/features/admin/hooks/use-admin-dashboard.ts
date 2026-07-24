"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminCases,
  fetchAdminOverview,
  fetchAdminReports,
  fetchAlerts,
  fetchExcelRecords
} from "../api/admin-api";
import type { RiskCaseFilters } from "../types/admin-types";

export const adminQueryKeys = {
  overview: (days: number) => ["admin", "overview", days] as const,
  reports: ["admin", "reports"] as const,
  cases: (filters: RiskCaseFilters) => [
    "admin",
    "cases",
    filters.riskLevel ?? "",
    filters.status ?? "",
    filters.page,
    filters.pageSize
  ] as const,
  excelRecords: ["admin", "excel-records"] as const,
  alerts: ["admin", "alerts"] as const,
  conversation: (sessionId: string) => ["admin", "conversation", sessionId] as const,
  knowledgeStatus: ["admin", "knowledge-status"] as const
};

export function useAdminOverview(days = 30) {
  return useQuery({
    queryKey: adminQueryKeys.overview(days),
    queryFn: () => fetchAdminOverview(days)
  });
}

export function useAdminCases(filters: RiskCaseFilters) {
  return useQuery({
    queryKey: adminQueryKeys.cases(filters),
    queryFn: () => fetchAdminCases(filters),
    placeholderData: (previous) => previous
  });
}

export function useAdminDashboard() {
  const reportsQuery = useQuery({
    queryKey: adminQueryKeys.reports,
    queryFn: fetchAdminReports
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
  const excelRecords = excelRecordsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return {
    reports,
    excelRecords,
    alerts,
    reportsQuery,
    excelRecordsQuery,
    alertsQuery
  };
}

import { apiClient } from "@/lib/api/api-client";

import type {
  AlertRecord,
  ConversationArchive,
  ExcelRecord,
  KnowledgeBackupResult,
  KnowledgeRebuildResult,
  KnowledgeStatus,
  KnowledgeUploadResult,
  RiskCase,
  RiskReport
} from "../types/admin-types";

export async function fetchAdminReports(): Promise<RiskReport[]> {
  const response = await apiClient.get<RiskReport[]>("/api/admin/reports");
  return response.data;
}

export async function fetchAdminCases(): Promise<RiskCase[]> {
  const response = await apiClient.get<RiskCase[]>("/api/admin/cases");
  return response.data;
}

export async function fetchExcelRecords(): Promise<ExcelRecord[]> {
  const response = await apiClient.get<ExcelRecord[]>("/api/admin/excel-records");
  return response.data;
}

export async function fetchAlerts(): Promise<AlertRecord[]> {
  const response = await apiClient.get<AlertRecord[]>("/api/admin/alerts");
  return response.data;
}

export async function fetchConversation(sessionId: string): Promise<ConversationArchive> {
  const response = await apiClient.get<ConversationArchive>(
    `/api/admin/conversations/${encodeURIComponent(sessionId)}`
  );
  return response.data;
}

export async function fetchKnowledgeStatus(): Promise<KnowledgeStatus> {
  const response = await apiClient.get<KnowledgeStatus>("/api/admin/knowledge/status");
  return response.data;
}

export async function uploadKnowledgeFile(file: File): Promise<KnowledgeUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<KnowledgeUploadResult>("/api/admin/knowledge/file", formData);
  return response.data;
}

export async function rebuildKnowledgeVector(): Promise<KnowledgeRebuildResult> {
  const response = await apiClient.post<KnowledgeRebuildResult>("/api/admin/knowledge/rebuild-vector");
  return response.data;
}

export async function backupKnowledgeVector(): Promise<KnowledgeBackupResult> {
  const response = await apiClient.post<KnowledgeBackupResult>("/api/admin/knowledge/backup");
  return response.data;
}

import { apiClient } from "@/lib/api/api-client";

import type {
  AlertRecord,
  ConversationArchive,
  ExcelRecord,
  KnowledgeBase,
  KnowledgeBaseFilters,
  KnowledgeBaseListResponse,
  KnowledgeBasePayload,
  KnowledgeDocumentUploadResult,
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

export async function fetchKnowledgeBases(filters: KnowledgeBaseFilters): Promise<KnowledgeBaseListResponse> {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.status) params.set("status", filters.status);
  if (filters.createdFrom) params.set("created_from", filters.createdFrom);
  if (filters.createdTo) params.set("created_to", filters.createdTo);
  if (filters.includeDeleted) params.set("include_deleted", "true");
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 20));
  const response = await apiClient.get<KnowledgeBaseListResponse>(`/api/admin/knowledge-bases?${params.toString()}`);
  return response.data;
}

export async function fetchKnowledgeBase(id: number): Promise<KnowledgeBase> {
  const response = await apiClient.get<KnowledgeBase>(`/api/admin/knowledge-bases/${id}`);
  return response.data;
}

export async function createKnowledgeBase(payload: Required<Pick<KnowledgeBasePayload, "name">> & KnowledgeBasePayload): Promise<KnowledgeBase> {
  const response = await apiClient.post<KnowledgeBase>("/api/admin/knowledge-bases", payload);
  return response.data;
}

export async function updateKnowledgeBase(id: number, payload: KnowledgeBasePayload): Promise<KnowledgeBase> {
  const response = await apiClient.patch<KnowledgeBase>(`/api/admin/knowledge-bases/${id}`, payload);
  return response.data;
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/knowledge-bases/${id}`);
}

export async function uploadKnowledgeDocument(id: number, file: File): Promise<KnowledgeDocumentUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<KnowledgeDocumentUploadResult>(`/api/admin/knowledge-bases/${id}/documents`, formData);
  return response.data;
}

export async function rebuildKnowledgeBase(id: number): Promise<{ indexedChunks: number }> {
  const response = await apiClient.post<{ indexedChunks: number }>(`/api/admin/knowledge-bases/${id}/rebuild`);
  return response.data;
}

import { apiClient } from "@/lib/api/api-client";

import type {
  AlertRecord,
  ConversationArchive,
  ExcelRecord,
  KnowledgeBase,
  KnowledgeBaseFilters,
  KnowledgeBaseListResponse,
  KnowledgeBasePayload,
  BatchDeleteDocumentsResult,
  DocumentSplitConfig,
  DocumentSplitPreviewResponse,
  KnowledgeDocumentFilters,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentReindexResult,
  KnowledgeDocumentUploadOptions,
  KnowledgeDocumentUploadResult,
  RiskCase,
  RiskReport,
  AdminUser,
  AdminUserCreatePayload,
  AdminUserFilters,
  AdminUserListResponse,
  AdminUserUpdatePayload,
  AgentRuntimeConfig,
  AgentRuntimeUpdatePayload,
} from "../types/admin-types";

export async function fetchAdminUsers(filters: AdminUserFilters): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (filters.username) params.set("username", filters.username);
  if (filters.role) params.set("role", filters.role);
  if (filters.createdFrom) params.set("created_from", filters.createdFrom);
  if (filters.createdTo) params.set("created_to", `${filters.createdTo}T23:59:59.999`);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 20));
  const response = await apiClient.get<AdminUserListResponse>(`/api/admin/users?${params.toString()}`);
  return response.data;
}

export async function createAdminUser(payload: AdminUserCreatePayload): Promise<AdminUser> {
  const response = await apiClient.post<AdminUser>("/api/admin/users", payload);
  return response.data;
}

export async function updateAdminUser(id: number, payload: AdminUserUpdatePayload): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/api/admin/users/${id}`, payload);
  return response.data;
}

export async function deleteAdminUser(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/users/${id}`);
}

export async function fetchAgentRuntimeConfig(): Promise<AgentRuntimeConfig> {
  const response = await apiClient.get<AgentRuntimeConfig>("/api/admin/agent-runtime");
  return response.data;
}

export async function updateAgentRuntimeConfig(
  payload: AgentRuntimeUpdatePayload,
): Promise<AgentRuntimeConfig> {
  const response = await apiClient.patch<AgentRuntimeConfig>(
    "/api/admin/agent-runtime",
    payload,
  );
  return response.data;
}

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

export async function uploadKnowledgeDocument(
  id: number,
  file: File,
  relativePath = file.name,
  onProgress?: (percent: number) => void,
  splitOptions?: KnowledgeDocumentUploadOptions
): Promise<KnowledgeDocumentUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("relative_path", relativePath);
  if (splitOptions) {
    formData.append("chunk_size", String(splitOptions.chunkSize));
    formData.append("chunk_overlap", String(splitOptions.chunkOverlap));
    formData.append("splitter_type", splitOptions.splitterType);
  }
  const response = await apiClient.post<KnowledgeDocumentUploadResult>(
    `/api/admin/knowledge-bases/${id}/documents`,
    formData,
    {
      timeout: 30 * 60 * 1000,
      onUploadProgress: (event) => {
        const total = event.total ?? file.size;
        if (total > 0) {
          onProgress?.(Math.min(100, Math.round((event.loaded / total) * 100)));
        }
      }
    }
  );
  return response.data;
}

export async function fetchKnowledgeDocuments(
  knowledgeBaseId: number,
  filters: KnowledgeDocumentFilters,
): Promise<KnowledgeDocumentListResponse> {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.status) params.set("status", filters.status);
  if (filters.createdFrom) params.set("created_from", filters.createdFrom);
  if (filters.createdTo) params.set("created_to", `${filters.createdTo}T23:59:59.999`);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 20));
  if (filters.sortBy) params.set("sort_by", filters.sortBy);
  if (filters.sortOrder) params.set("sort_order", filters.sortOrder);
  const response = await apiClient.get<KnowledgeDocumentListResponse>(
    `/api/admin/knowledge-bases/${knowledgeBaseId}/documents?${params.toString()}`,
  );
  return response.data;
}

export async function previewKnowledgeDocumentSplit(
  knowledgeBaseId: number,
  documentId: number,
  payload: DocumentSplitConfig,
): Promise<DocumentSplitPreviewResponse> {
  const response = await apiClient.post<DocumentSplitPreviewResponse>(
    `/api/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/split-preview`,
    payload,
  );
  return response.data;
}

export async function reindexKnowledgeDocument(
  knowledgeBaseId: number,
  documentId: number,
  payload: DocumentSplitConfig,
): Promise<KnowledgeDocumentReindexResult> {
  const response = await apiClient.post<KnowledgeDocumentReindexResult>(
    `/api/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/reindex`,
    payload,
  );
  return response.data;
}

export async function deleteKnowledgeDocument(
  knowledgeBaseId: number,
  documentId: number,
): Promise<void> {
  await apiClient.delete(
    `/api/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`,
  );
}

export async function batchDeleteKnowledgeDocuments(
  knowledgeBaseId: number,
  documentIds: number[],
): Promise<BatchDeleteDocumentsResult> {
  const response = await apiClient.post<BatchDeleteDocumentsResult>(
    `/api/admin/knowledge-bases/${knowledgeBaseId}/documents/batch-delete`,
    { documentIds },
  );
  return response.data;
}

export async function rebuildKnowledgeBase(id: number): Promise<{ indexedChunks: number }> {
  const response = await apiClient.post<{ indexedChunks: number }>(`/api/admin/knowledge-bases/${id}/rebuild`);
  return response.data;
}

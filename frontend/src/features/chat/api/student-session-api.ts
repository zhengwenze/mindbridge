import { apiClient } from "@/lib/api/api-client";

import type { StudentConversationDetail, StudentSessionSummary } from "../types/chat-types";

export interface StudentDocumentPreview {
  documentId: number;
  knowledgeBaseId: number;
  fileName: string;
  fileType: string;
  content: string;
  highlight?: string | null;
}

export async function fetchStudentSessions(): Promise<StudentSessionSummary[]> {
  const response = await apiClient.get<StudentSessionSummary[]>("/api/student/sessions");
  return response.data;
}

export async function fetchStudentSession(sessionId: string): Promise<StudentConversationDetail> {
  const response = await apiClient.get<StudentConversationDetail>(
    `/api/student/sessions/${encodeURIComponent(sessionId)}`
  );
  return response.data;
}

export async function fetchStudentDocument(documentId: number, chunkId?: number | null): Promise<StudentDocumentPreview> {
  const params = chunkId ? { chunk_id: chunkId } : undefined;
  const response = await apiClient.get<StudentDocumentPreview>(`/api/student/documents/${documentId}`, { params });
  return response.data;
}

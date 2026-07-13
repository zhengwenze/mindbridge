import { apiClient } from "@/lib/api/api-client";

import type { StudentConversationDetail, StudentSessionSummary } from "../types/chat-types";

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

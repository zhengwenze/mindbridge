export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | string;

export interface RiskReport {
  id?: number | string;
  sessionId?: string | null;
  displayName?: string;
  username?: string;
  riskLevel?: RiskLevel;
  createdAt?: string;
  summary?: string;
  content?: string;
}

export interface RiskCase {
  id?: number | string;
  reportId?: number | string;
  riskLevel?: RiskLevel;
  status?: string;
  owner?: string | null;
  updatedAt?: string;
  summary?: string;
  handoffSummary?: string;
}

export interface ExcelRecord {
  id?: number | string;
  reportId?: number | string;
  status?: string;
  message?: string;
  createdAt?: string;
  filePath?: string;
}

export interface AlertRecord {
  id?: number | string;
  reportId?: number | string;
  status?: string;
  message?: string;
  createdAt?: string;
  channel?: string;
  recipient?: string;
}

export interface ConversationMessage {
  id?: number | string;
  role?: string;
  content?: string;
  createdAt?: string;
}

export interface ConversationArchive {
  sessionId?: string;
  title?: string;
  messages?: ConversationMessage[];
}

export type KnowledgeBaseStatus = "active" | "disabled" | "indexing" | "error" | "DELETING" | "DELETE_FAILED";

export interface KnowledgeBaseReferenceDetail {
  type: "agent" | "application" | "department" | "running_task";
  id: string;
  name: string;
  status: string;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  collectionName: string;
  status: KnowledgeBaseStatus;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  documentCount: number;
  chunkCount: number;
  vectorCount?: number;
  collectionExists?: boolean;
  embeddingModel?: string;
  vectorError?: string;
}

export interface KnowledgeBaseListResponse {
  items: KnowledgeBase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KnowledgeBaseFilters {
  name?: string;
  status?: KnowledgeBaseStatus;
  createdFrom?: string;
  createdTo?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface KnowledgeBasePayload {
  name?: string;
  description?: string;
  status?: "active" | "disabled";
}

export interface KnowledgeDocumentUploadResult {
  id: number;
  knowledgeBaseId: number;
  fileName: string;
  relativePath: string;
  fileSize: number;
  chunks: number;
  indexStatus: string;
}

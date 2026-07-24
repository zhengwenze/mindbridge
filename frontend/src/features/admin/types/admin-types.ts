export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | string;
export type RiskLevelFilter = "HIGH" | "MEDIUM" | "LOW";
export type RiskCaseStatus = "OPEN" | "ALERT_SENT" | "ACKNOWLEDGED";

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
  status?: RiskCaseStatus | string;
  owner?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  summary?: string;
  handoffSummary?: string;
}

export interface RiskCaseFilters {
  riskLevel?: RiskLevelFilter;
  status?: RiskCaseStatus;
  page: number;
  pageSize: number;
}

export interface RiskCaseListResponse {
  items: RiskCase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOverviewSummary {
  totalReports: number;
  periodReports: number;
  todayReports: number;
  periodHighRiskReports: number;
  periodHighRiskRate: number;
}

export interface AdminOverviewRiskDistributionItem {
  riskLevel: RiskLevelFilter;
  count: number;
  percentage: number;
}

export interface AdminOverviewTrendPoint {
  date: string;
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface AdminOverviewProcessing {
  excelTotal: number;
  excelSuccess: number;
  excelFailed: number;
  alertTotal: number;
  alertSuccess: number;
  alertFailed: number;
  alertSuccessRate: number;
}

export interface AdminOverviewData {
  periodDays: number;
  generatedAt: string;
  summary: AdminOverviewSummary;
  riskDistribution: AdminOverviewRiskDistributionItem[];
  dailyTrend: AdminOverviewTrendPoint[];
  processing: AdminOverviewProcessing;
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

export type AdminUserRole = "ROLE_USER" | "ROLE_ADMIN";

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: AdminUserRole;
  createdAt: string;
}

export interface AdminUserFilters {
  username?: string;
  role?: AdminUserRole;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserCreatePayload {
  username: string;
  password: string;
  displayName?: string;
  role: AdminUserRole;
}

export interface AdminUserUpdatePayload {
  displayName?: string;
  password?: string;
  role?: AdminUserRole;
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
  parserName?: string;
  splitterType?: DocumentSplitterType;
  chunkSize?: number;
  chunkOverlap?: number;
  contentHash?: string;
  warnings?: string[];
}

export type DocumentSplitterType = "recursive_character";
export type DocumentSortOrder = "asc" | "desc";
export type DocumentSortField =
  | "created_at"
  | "updated_at"
  | "file_name"
  | "file_size"
  | "index_status"
  | "indexed_at"
  | "chunk_count";

export interface DocumentSplitConfig {
  chunkSize: number;
  chunkOverlap: number;
  splitterType: DocumentSplitterType;
}

export type KnowledgeDocumentUploadOptions = DocumentSplitConfig;

export interface KnowledgeDocument {
  id: number;
  knowledgeBaseId: number;
  fileName: string;
  relativePath: string;
  fileType: string;
  mimeType?: string | null;
  fileSize: number;
  indexStatus: string;
  errorMessage?: string | null;
  chunkCount: number;
  chunkSize: number;
  chunkOverlap: number;
  splitterType: DocumentSplitterType;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string | null;
}

export interface KnowledgeDocumentFilters {
  name?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: DocumentSortField;
  sortOrder?: DocumentSortOrder;
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentSplitPreviewItem {
  index: number;
  content: string;
  charCount: number;
}

export interface DocumentSplitPreviewResponse {
  totalChunks: number;
  items: DocumentSplitPreviewItem[];
  truncated: boolean;
}

export interface KnowledgeDocumentReindexResult {
  documentId?: number;
  id?: number;
  revision: number;
  chunks?: number;
  chunkCount?: number;
  chunkSize: number;
  chunkOverlap: number;
  splitterType: DocumentSplitterType;
  indexStatus: string;
  indexedAt?: string | null;
}

export interface BatchDeleteDocumentsResult {
  deletedCount?: number;
  documentIds?: number[];
}

export type AgentRuntimeFramework =
  | "event_driven_multi_agent"
  | "langgraph"
  | "custom";

export interface AgentRuntimeOption {
  value: AgentRuntimeFramework;
  label: string;
  available: boolean;
  description: string;
}

export interface AgentRuntimeConfig {
  currentFramework: AgentRuntimeFramework;
  activeFramework: AgentRuntimeFramework;
  defaultFramework: "langgraph";
  persistence: "process";
  options: AgentRuntimeOption[];
}

export interface AgentRuntimeUpdatePayload {
  framework: AgentRuntimeFramework;
}

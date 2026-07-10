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

export interface KnowledgeStatus {
  databaseChunks?: number;
  vectorAvailable?: boolean;
  vectorChunks?: number;
}

export interface KnowledgeUploadResult {
  source?: string;
  chunks?: number;
}

export interface KnowledgeRebuildResult {
  indexedChunks?: number;
}

export interface KnowledgeBackupResult {
  snapshot?: string;
}

export type ChatRole = "user" | "assistant";

export type SessionStatus = "READY" | "THINKING" | "DONE" | "ERROR";

export interface Message {
  id: string;
  role: ChatRole;
  content: string;
}

export interface StudentSessionSummary {
  sessionId: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentConversationMessage {
  id: number;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface StudentConversationDetail {
  sessionId: string;
  title: string;
  messages: StudentConversationMessage[];
}

export interface ChatMetaEvent {
  type: "meta";
  sessionId: string;
}

export interface ChatTokenEvent {
  type: "token";
  content: string;
}

export interface ChatErrorEvent {
  type: "error";
  message: string;
  sessionId?: string;
}

export type ChatStreamEvent = ChatMetaEvent | ChatTokenEvent | ChatErrorEvent;

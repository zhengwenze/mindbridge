export type ChatRole = "user" | "assistant";

export type SessionStatus = "READY" | "THINKING" | "DONE" | "ERROR";

export interface Message {
  id: string;
  role: ChatRole;
  content: string;
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

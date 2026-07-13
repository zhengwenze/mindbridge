import { readAuthSession } from "@/lib/auth/token-storage";
import { buildApiUrl } from "@/lib/config/api";

import type { ChatStreamEvent } from "../types/chat-types";

interface StreamChatParams {
  message: string;
  sessionId: string | null;
  signal?: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}

function parseChatStreamEvent(raw: unknown): ChatStreamEvent | null {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) return null;

  const event = raw as Record<string, unknown>;

  if (event.type === "meta" && typeof event.sessionId === "string") {
    return {
      type: "meta",
      sessionId: event.sessionId
    };
  }

  if (event.type === "token") {
    return {
      type: "token",
      content: typeof event.content === "string" ? event.content : ""
    };
  }

  if (event.type === "error") {
    return {
      type: "error",
      message: typeof event.message === "string" ? event.message : "聊天流处理失败",
      sessionId: typeof event.sessionId === "string" ? event.sessionId : undefined
    };
  }

  return null;
}

function parseSseChunk(buffer: string, onEvent: (event: ChatStreamEvent) => void): string {
  const parts = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    const dataLines = part
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    if (dataLines.length === 0) continue;

    const rawData = dataLines.join("\n");

    try {
      const event = parseChatStreamEvent(JSON.parse(rawData));
      if (event) onEvent(event);
    } catch {
      onEvent({ type: "error", message: "聊天流事件解析失败" });
    }
  }

  return rest;
}

export async function streamChatMessage({
  message,
  sessionId,
  signal,
  onEvent
}: StreamChatParams): Promise<void> {
  const authSession = readAuthSession();
  const headers = new Headers({
    "Accept": "text/event-stream",
    "Cache-Control": "no-cache",
    "Content-Type": "application/json"
  });

  if (authSession?.token) {
    headers.set("Authorization", `Basic ${authSession.token}`);
  }

  const response = await fetch(buildApiUrl("/api/chat/stream"), {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, message }),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持聊天流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseChunk(buffer, onEvent);
  }

  buffer += decoder.decode();
  parseSseChunk(`${buffer}\n\n`, onEvent);
}

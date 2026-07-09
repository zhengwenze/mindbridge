"use client";

import { useCallback, useRef, useState } from "react";

import { streamChatMessage } from "../api/chat-stream-api";
import type { ChatStreamEvent, Message, SessionStatus } from "../types/chat-types";

function createMessageId(role: Message["role"]): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("READY");
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetSession = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setSessionId(null);
    setStreaming(false);
    setSessionStatus("READY");
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message || streaming) return;

      const userMessage: Message = {
        id: createMessageId("user"),
        role: "user",
        content: message
      };
      const assistantMessageId = createMessageId("assistant");
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: ""
      };
      const abortController = new AbortController();
      let streamFailed = false;

      abortControllerRef.current = abortController;
      setMessages((current) => [...current, userMessage, assistantMessage]);
      setStreaming(true);
      setSessionStatus("THINKING");

      function handleEvent(event: ChatStreamEvent) {
        if (event.type === "meta") {
          setSessionId(event.sessionId);
          return;
        }

        if (event.type === "token") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    content: item.content + event.content
                  }
                : item
            )
          );
          return;
        }

        streamFailed = true;
        setSessionStatus("ERROR");
        if (event.sessionId) setSessionId(event.sessionId);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId && item.content.length === 0
              ? {
                  ...item,
                  content: event.message || "聊天流处理失败"
                }
              : item
          )
        );
      }

      try {
        await streamChatMessage({
          message,
          sessionId,
          signal: abortController.signal,
          onEvent: handleEvent
        });

        if (!streamFailed) {
          setSessionStatus("DONE");
        }
      } catch (error) {
        if (abortController.signal.aborted) return;

        setSessionStatus("ERROR");
        const errorMessage = error instanceof Error ? error.message : "发送失败";
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId && item.content.length === 0
              ? {
                  ...item,
                  content: `发送失败：${errorMessage}`
                }
              : item
          )
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setStreaming(false);
      }
    },
    [sessionId, streaming]
  );

  return {
    messages,
    sessionId,
    streaming,
    sessionStatus,
    sendMessage,
    resetSession
  };
}

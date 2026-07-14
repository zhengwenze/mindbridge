"use client";

import { Button, Card, Empty, Input, Space, Tag, Typography } from "antd";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { useChatStream } from "../hooks/use-chat-stream";
import type { Message, SessionStatus } from "../types/chat-types";
import type { ChatSource } from "../types/chat-types";
import { MarkdownMessage } from "./markdown-message";
import { StudentDocumentDrawer } from "./student-document-drawer";

export const quickPrompts = [
  { label: "压力失眠", prompt: "我最近压力很大，晚上总是睡不着。" },
  { label: "焦虑倾诉", prompt: "我感觉很焦虑，考试前完全静不下来。" },
  { label: "低落求助", prompt: "我最近情绪很低落，不太想和别人说话。" },
  { label: "关系困扰", prompt: "我想聊聊最近和家人的矛盾。" }
];

const sessionStatusMeta: Record<SessionStatus, { label: string; color: string }> = {
  READY: { label: "READY", color: "default" },
  THINKING: { label: "THINKING", color: "warning" },
  DONE: { label: "DONE", color: "success" },
  ERROR: { label: "ERROR", color: "error" }
};

type ChatController = ReturnType<typeof useChatStream>;

function ChatMessage({ message, onSourceClick }: { message: Message; onSourceClick: (source: ChatSource) => void }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-3xl ${isUser ? "text-right" : "text-left"}`}>
        <Typography.Text className="mb-1 block !text-xs !font-semibold !text-slate-500">
          {isUser ? "我" : "MindBridge"}
        </Typography.Text>
        <div className={`break-words rounded-md border px-4 py-3 text-left leading-7 ${isUser ? "border-teal-200 bg-teal-50 text-slate-900" : "border-slate-200 bg-white text-slate-900"}`}>
          {message.content ? (isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : (
            <MarkdownMessage content={message.content} sources={message.sources} onSourceClick={onSourceClick} />
          )) : <span className="text-slate-400">正在输入...</span>}
        </div>
      </div>
    </article>
  );
}

interface StudentChatPanelProps {
  chat: ChatController;
  title?: string | null;
  compact?: boolean;
}

export function StudentChatPanel({ chat, title, compact = false }: StudentChatPanelProps) {
  const { messages, sessionId, streaming, loadingSession, sessionStatus, sendMessage, resetSession } = chat;
  const [draft, setDraft] = useState("");
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const statusMeta = sessionStatusMeta[sessionStatus];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming || loadingSession) return;
    setDraft("");
    await sendMessage(message);
  }

  return (
    <Card variant="outlined" className="flex min-h-0 w-full overflow-hidden [&_.ant-card-body]:flex [&_.ant-card-body]:w-full [&_.ant-card-body]:flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title ? <Typography.Title level={5} ellipsis={{ tooltip: title }} className="!mb-0">{title}</Typography.Title> : null}
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((item) => (
                <Button key={item.label} size="small" onClick={() => setDraft(item.prompt)} disabled={streaming || loadingSession}>{item.label}</Button>
              ))}
            </div>
          </div>
          <Tag color={statusMeta.color} className="!m-0 !px-3 !py-1">{statusMeta.label}</Tag>
        </div>

        <div className={`${compact ? "min-h-[300px]" : "min-h-[360px]"} flex-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4`}>
          {loadingSession ? (
            <Empty description="正在加载会话" className="flex min-h-[260px] flex-col justify-center" />
          ) : messages.length === 0 ? (
            <Empty description="开始对话" className="flex min-h-[260px] flex-col justify-center" />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message) => <ChatMessage key={message.id} message={message} onSourceClick={setSelectedSource} />)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <Input.TextArea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下你现在想说的话..." autoSize={{ minRows: 3, maxRows: 6 }} disabled={streaming || loadingSession} />
          <Space className="justify-end">
            <Button onClick={resetSession} disabled={messages.length === 0 && !sessionId && !streaming}>新会话</Button>
            <Button type="primary" htmlType="submit" loading={streaming} disabled={!draft.trim() || loadingSession}>发送</Button>
          </Space>
        </form>
      </div>
      <StudentDocumentDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />
    </Card>
  );
}

"use client";

import { Alert, Card, Empty, List, Skeleton, Typography } from "antd";
import type { UseQueryResult } from "@tanstack/react-query";

import { toApiError } from "@/lib/api/api-error";

import type { ConversationArchive } from "../types/admin-types";
import { formatDateTime, roleLabel } from "./admin-view-utils";

interface ConversationArchivePanelProps {
  sessionId: string | null;
  missingSession: boolean;
  query: UseQueryResult<ConversationArchive, Error>;
}

export function ConversationArchivePanel({ sessionId, missingSession, query }: ConversationArchivePanelProps) {
  const messages = query.data?.messages ?? [];
  const title = query.data?.title || query.data?.sessionId || sessionId || "会话档案审阅";

  return (
    <Card title="会话档案审阅" variant="outlined">
      {missingSession ? (
        <Alert type="warning" showIcon title="该报告缺少会话 ID" description="无法读取对应会话档案。" />
      ) : !sessionId ? (
        <Empty description="选择一条报告查看历史消息" />
      ) : query.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : query.error ? (
        <Alert type="error" showIcon title="会话读取失败" description={toApiError(query.error).message} />
      ) : messages.length === 0 ? (
        <Empty description={`${title} 暂无消息`} />
      ) : (
        <div className="grid gap-3">
          <Typography.Text type="secondary">
            {title} · {messages.length} 条消息
          </Typography.Text>
          <List
            dataSource={messages}
            renderItem={(message) => {
              const isUser = (message.role ?? "").toUpperCase() === "USER";
              return (
                <List.Item className={isUser ? "!justify-end" : undefined}>
                  <article className={`max-w-3xl ${isUser ? "ml-auto text-right" : "text-left"}`}>
                    <div className="mb-1 flex flex-wrap justify-between gap-3 text-xs text-slate-500">
                      <Typography.Text strong>{roleLabel(message.role)}</Typography.Text>
                      <Typography.Text type="secondary">{formatDateTime(message.createdAt)}</Typography.Text>
                    </div>
                    <div
                      className={`whitespace-pre-wrap break-words rounded border px-4 py-3 text-left leading-7 ${
                        isUser ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {message.content || "暂无内容"}
                    </div>
                  </article>
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </Card>
  );
}

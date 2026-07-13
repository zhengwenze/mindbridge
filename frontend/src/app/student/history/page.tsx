"use client";

import { Alert, Button, Card, Empty, Skeleton, Space, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { StudentChatPanel } from "@/features/chat/components/student-chat-panel";
import { fetchStudentSessions } from "@/features/chat/api/student-session-api";
import { useChatStream } from "@/features/chat/hooks/use-chat-stream";
import type { StudentSessionSummary } from "@/features/chat/types/chat-types";

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function HistoryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("sessionId");
  const chat = useChatStream();
  const { loadSession, resetSession, sessionStatus, streaming } = chat;
  const [sessions, setSessions] = useState<StudentSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchStudentSessions()
      .then((items) => {
        if (!active) return;
        setSessions(items);
        if (!selectedId && items[0]) router.replace(`/student/history?sessionId=${encodeURIComponent(items[0].sessionId)}`);
      })
      .catch(() => active && setError("历史会话加载失败，请稍后重试。"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      resetSession();
      return;
    }
    setDetailError(null);
    loadSession(selectedId).catch(() => setDetailError("会话不存在或无法访问。"));
  }, [selectedId, loadSession, resetSession]);

  useEffect(() => {
    if (!selectedId || sessionStatus !== "DONE") return;
    fetchStudentSessions().then(setSessions).catch(() => undefined);
  }, [sessionStatus, selectedId]);

  function selectSession(sessionId: string) {
    if (!streaming) router.replace(`/student/history?sessionId=${encodeURIComponent(sessionId)}`);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:px-8">
      <Card title="历史会话" variant="outlined" className="w-full shrink-0 lg:w-80" styles={{ body: { padding: 0 } }}>
        {loading ? <div className="space-y-4 p-4"><Skeleton active /><Skeleton active /></div> : error ? <Alert message={error} type="error" showIcon className="m-4" /> : sessions.length === 0 ? (
          <Empty description="暂时没有历史会话" className="p-6"><Button type="primary" onClick={() => router.push("/student")}>开始新的心理咨询</Button></Empty>
        ) : (
          <div role="list" className="divide-y divide-slate-200">
            {sessions.map((item) => (
              <button
                key={item.sessionId}
                type="button"
                role="listitem"
                aria-current={item.sessionId === selectedId ? "page" : undefined}
                disabled={streaming}
                className={`w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${item.sessionId === selectedId ? "bg-teal-50" : ""}`}
                onClick={() => selectSession(item.sessionId)}
              >
                <div className="min-w-0 w-full">
                  <Typography.Text strong ellipsis={{ tooltip: item.title }} className="block">{item.title || "未命名会话"}</Typography.Text>
                  <Typography.Paragraph ellipsis={{ rows: 2 }} className="!mb-1 !text-xs !text-slate-500">{item.lastMessage || "暂无消息"}</Typography.Paragraph>
                  <Space size="small" className="!text-xs !text-slate-400"><span>{formatTime(item.updatedAt)}</span><span>{item.messageCount} 条消息</span></Space>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex min-h-[520px] min-w-0 flex-1 flex-col gap-3">
        {detailError ? <Alert message={detailError} type="error" showIcon /> : null}
        <StudentChatPanel chat={chat} title={chat.sessionTitle} compact />
      </div>
    </main>
  );
}

export default function StudentHistoryPage() {
  return <Suspense fallback={<main className="p-8"><Skeleton active /></main>}><HistoryWorkspace /></Suspense>;
}

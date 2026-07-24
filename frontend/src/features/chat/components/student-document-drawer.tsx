"use client";

import { Alert, Descriptions, Drawer, Empty, Spin, Typography } from "antd";
import { useEffect, useState } from "react";

import { fetchStudentDocument, type StudentDocumentPreview } from "../api/student-session-api";
import type { ChatSource } from "../types/chat-types";
import { MarkdownContent } from "./markdown-message";

interface StudentDocumentDrawerProps {
  source: ChatSource | null;
  onClose: () => void;
}

export function StudentDocumentDrawer({ source, onClose }: StudentDocumentDrawerProps) {
  const [document, setDocument] = useState<StudentDocumentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) return;
    let active = true;
    setDocument(null);
    setError(null);
    fetchStudentDocument(source.documentId, source.chunkId)
      .then((value) => active && setDocument(value))
      .catch(() => active && setError("原文加载失败，文档可能已删除或暂不可用。"));
    return () => { active = false; };
  }, [source]);

  return (
    <Drawer
      open={Boolean(source)}
      onClose={onClose}
      title={source?.fileName || "文档原文"}
      placement="right"
      width={Math.min(720, typeof window === "undefined" ? 720 : window.innerWidth * 0.9)}
    >
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {!error && !document ? <div className="flex min-h-32 items-center justify-center"><Spin /></div> : null}
      {document ? (
        <div className="space-y-4">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="文件名">{document.fileName}</Descriptions.Item>
            <Descriptions.Item label="文件类型">{document.fileType}</Descriptions.Item>
            <Descriptions.Item label="文档 ID">{document.documentId}</Descriptions.Item>
          </Descriptions>
          {document.highlight ? (
            <section>
              <Typography.Title level={5}>相关片段</Typography.Title>
              <MarkdownContent
                content={document.highlight}
                className="break-words rounded-md border border-amber-200 bg-amber-50 p-3 text-slate-800"
              />
            </section>
          ) : null}
          <section>
            <Typography.Title level={5}>原文</Typography.Title>
            {document.content ? (
              <MarkdownContent content={document.content} className="break-words text-slate-800" />
            ) : (
              <Empty description="文档暂无可展示内容" />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

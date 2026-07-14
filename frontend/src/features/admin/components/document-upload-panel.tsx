"use client";

import {
  DeleteOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  InputNumber,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import { uploadKnowledgeDocument } from "../api/admin-api";
import { knowledgeQueryKeys, useKnowledgeBases } from "../hooks/use-knowledge-actions";
import type {
  DocumentSplitConfig,
  KnowledgeDocumentUploadResult,
} from "../types/admin-types";

const { Dragger } = Upload;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["txt", "md", "markdown", "pdf", "docx"]);
const UPLOAD_ACCEPT = ".txt,.md,.markdown,.pdf,.docx";
const DEFAULT_SPLIT_CONFIG: DocumentSplitConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
  splitterType: "recursive_character",
};

type UploadStatus = "queued" | "uploading" | "processing" | "success" | "error";

interface QueuedDocument {
  id: string;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: KnowledgeDocumentUploadResult;
}

function queueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function relativePathOf(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function extensionOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function statusTag(status: UploadStatus) {
  const values: Record<UploadStatus, { color: string; text: string }> = {
    queued: { color: "default", text: "等待上传" },
    uploading: { color: "processing", text: "上传中" },
    processing: { color: "cyan", text: "解析入库中" },
    success: { color: "success", text: "上传成功" },
    error: { color: "error", text: "上传失败" },
  };
  return <Tag color={values[status].color}>{values[status].text}</Tag>;
}

export function DocumentUploadPanel() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<number | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [queue, setQueue] = useState<QueuedDocument[]>([]);
  const [running, setRunning] = useState(false);
  const [splitConfig, setSplitConfig] = useState<DocumentSplitConfig>(DEFAULT_SPLIT_CONFIG);
  const basesQuery = useKnowledgeBases({
    name: knowledgeSearch || undefined,
    status: "active",
    page: 1,
    pageSize: 100,
  });

  const summary = useMemo(
    () => ({
      success: queue.filter((item) => item.status === "success").length,
      error: queue.filter((item) => item.status === "error").length,
      pending: queue.filter((item) => item.status === "queued").length,
    }),
    [queue],
  );
  const splitConfigError =
    splitConfig.chunkSize < 100 || splitConfig.chunkSize > 4000
      ? "Chunk 大小必须为 100～4000 个字符"
      : splitConfig.chunkOverlap < 0 || splitConfig.chunkOverlap > 1000
        ? "重叠大小必须为 0～1000 个字符"
        : splitConfig.chunkOverlap >= splitConfig.chunkSize
          ? "重叠大小必须小于 Chunk 大小"
          : null;

  function updateItem(id: string, patch: Partial<QueuedDocument>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function enqueue(uploadFile: UploadFile | File): boolean {
    const file = uploadFile as File;
    const relativePath = relativePathOf(file);
    const extension = extensionOf(relativePath);
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      message.error(`${relativePath}：仅支持 TXT、Markdown、PDF 和 DOCX`);
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      message.error(`${relativePath}：单个文件不能超过 50 MB`);
      return false;
    }
    setQueue((current) => {
      if (current.some((item) => item.relativePath === relativePath)) {
        message.warning(`${relativePath} 已在上传队列中`);
        return current;
      }
      return [
        ...current,
        { id: queueId(), file, relativePath, status: "queued", progress: 0 },
      ];
    });
    return false;
  }

  async function uploadOne(
    item: QueuedDocument,
    targetId: number,
    uploadSplitConfig: DocumentSplitConfig,
  ) {
    updateItem(item.id, { status: "uploading", progress: 0, error: undefined });
    try {
      const result = await uploadKnowledgeDocument(
        targetId,
        item.file,
        item.relativePath,
        (progress) =>
          updateItem(item.id, {
            progress,
            status: progress >= 100 ? "processing" : "uploading",
          }),
        uploadSplitConfig,
      );
      updateItem(item.id, { status: "success", progress: 100, result });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(targetId) });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
    } catch (error) {
      updateItem(item.id, {
        status: "error",
        error: toApiError(error).message,
      });
    }
  }

  async function startUpload() {
    if (knowledgeBaseId === null) {
      message.warning("请先选择目标知识库");
      return;
    }
    if (splitConfigError) {
      message.warning(splitConfigError);
      return;
    }
    const pending = queue.filter((item) => item.status === "queued");
    if (pending.length === 0) {
      message.warning("请先添加待上传文档");
      return;
    }
    const targetId = knowledgeBaseId;
    const uploadSplitConfig = { ...splitConfig };
    setRunning(true);
    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const item = pending[cursor];
        cursor += 1;
        await uploadOne(item, targetId, uploadSplitConfig);
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card title="上传目标" variant="outlined">
        <div className="grid gap-3">
          <Typography.Text>目标知识库</Typography.Text>
          <Select
            className="w-full max-w-xl"
            placeholder="搜索并选择正常状态的知识库"
            showSearch
            filterOption={false}
            loading={basesQuery.isLoading}
            disabled={running}
            value={knowledgeBaseId}
            onSearch={setKnowledgeSearch}
            onChange={setKnowledgeBaseId}
            options={(basesQuery.data?.items ?? []).map((base) => ({
              value: base.id,
              label: base.name,
            }))}
            notFoundContent={basesQuery.isLoading ? "正在读取…" : "没有匹配的知识库"}
          />
          <Typography.Text type="secondary">
            本次队列中的所有文档都会上传到同一个知识库；上传期间不能切换。
          </Typography.Text>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div className="grid gap-1">
              <Typography.Text>Chunk 大小（字符）</Typography.Text>
              <InputNumber
                className="w-full"
                min={100}
                max={4000}
                step={50}
                value={splitConfig.chunkSize}
                disabled={running}
                onChange={(value) =>
                  typeof value === "number" &&
                  setSplitConfig((current) => ({ ...current, chunkSize: value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Typography.Text>重叠大小（字符）</Typography.Text>
              <InputNumber
                className="w-full"
                min={0}
                max={1000}
                step={10}
                value={splitConfig.chunkOverlap}
                disabled={running}
                onChange={(value) =>
                  typeof value === "number" &&
                  setSplitConfig((current) => ({ ...current, chunkOverlap: value }))
                }
              />
            </div>
          </div>
          <Typography.Text type={splitConfigError ? "danger" : "secondary"}>
            {splitConfigError ?? "使用递归字符拆分；配置会分别保存到本次上传的每个文档。"}
          </Typography.Text>
        </div>
      </Card>

      <Card title="添加文档" variant="outlined">
        <div className="grid gap-4">
          <Dragger
            accept={UPLOAD_ACCEPT}
            multiple
            showUploadList={false}
            disabled={running}
            beforeUpload={enqueue}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">拖拽文档到这里，或点击选择多个文件</p>
            <p className="ant-upload-hint">支持 TXT、MD、Markdown、PDF、DOCX，单个文件最大 50 MB</p>
          </Dragger>
          <Space wrap>
            <Upload
              accept={UPLOAD_ACCEPT}
              directory
              multiple
              showUploadList={false}
              disabled={running}
              beforeUpload={enqueue}
            >
              <Button icon={<FolderOpenOutlined />}>选择文件夹</Button>
            </Upload>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              disabled={running || summary.pending === 0}
              loading={running}
              onClick={startUpload}
            >
              开始上传 ({summary.pending})
            </Button>
            <Button
              disabled={running || !queue.some((item) => item.status === "success")}
              onClick={() => setQueue((current) => current.filter((item) => item.status !== "success"))}
            >
              清除已完成
            </Button>
          </Space>
        </div>
      </Card>

      {queue.length > 0 ? (
        <Card
          title={`上传队列（${queue.length}）`}
          extra={<Typography.Text type="secondary">成功 {summary.success} · 失败 {summary.error}</Typography.Text>}
          variant="outlined"
        >
          <div className="grid gap-3">
            {queue.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography.Text strong className="break-all">{item.relativePath}</Typography.Text>
                      {statusTag(item.status)}
                    </div>
                    <Typography.Text type="secondary" className="text-xs">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      {item.result ? ` · ${item.result.chunks} 个片段` : ""}
                      {item.result?.chunkSize !== undefined
                        ? ` · ${item.result.chunkSize}/${item.result.chunkOverlap ?? 0} 字符`
                        : ""}
                    </Typography.Text>
                    {item.status === "uploading" || item.status === "processing" ? (
                      <Progress
                        className="!mb-0 !mt-2"
                        percent={item.progress}
                        status="active"
                        format={(percent) => item.status === "processing" ? "解析中" : `${percent}%`}
                      />
                    ) : null}
                    {item.error ? <Alert className="mt-2" type="error" showIcon title={item.error} /> : null}
                    {item.result?.warnings?.length ? (
                      <Alert
                        className="mt-2"
                        type="warning"
                        showIcon
                        title="解析完成，但有提示"
                        description={item.result.warnings.join("；")}
                      />
                    ) : null}
                  </div>
                  <Space>
                    {item.status === "error" ? (
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        disabled={running}
                        onClick={() => updateItem(item.id, { status: "queued", progress: 0, error: undefined })}
                      >
                        重试
                      </Button>
                    ) : null}
                    {item.status === "queued" || item.status === "error" ? (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={running}
                        onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))}
                      >
                        移除
                      </Button>
                    ) : null}
                  </Space>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card variant="outlined"><Empty description="上传队列为空" /></Card>
      )}
    </div>
  );
}

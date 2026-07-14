"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  InputNumber,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import { useKnowledgeDocumentActions } from "../hooks/use-knowledge-actions";
import type {
  DocumentSplitConfig,
  DocumentSplitPreviewResponse,
  KnowledgeDocument,
} from "../types/admin-types";

interface DocumentSplitDrawerProps {
  knowledgeBaseId: number;
  document: KnowledgeDocument | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentSplitDrawer({
  knowledgeBaseId,
  document,
  open,
  onClose,
}: DocumentSplitDrawerProps) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<DocumentSplitConfig>();
  const [preview, setPreview] = useState<DocumentSplitPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const actions = useKnowledgeDocumentActions(knowledgeBaseId);
  const actionBlocked =
    document?.indexStatus === "indexing" ||
    document?.indexStatus === "deleting" ||
    document?.indexStatus === "DELETING";

  useEffect(() => {
    if (!document || !open) return;
    form.setFieldsValue({
      chunkSize: document.chunkSize,
      chunkOverlap: document.chunkOverlap,
      splitterType: document.splitterType,
    });
    setPreview(null);
    setPreviewError(null);
  }, [document, form, open]);

  async function readConfig(): Promise<DocumentSplitConfig | null> {
    try {
      return await form.validateFields();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return null;
      throw error;
    }
  }

  async function loadPreview() {
    if (!document) return;
    const payload = await readConfig();
    if (!payload) return;
    setPreviewError(null);
    try {
      const result = await actions.previewMutation.mutateAsync({
        documentId: document.id,
        payload,
      });
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setPreviewError(toApiError(error).message);
    }
  }

  async function confirmReindex() {
    if (!document) return;
    const payload = await readConfig();
    if (!payload) return;
    modal.confirm({
      title: "应用拆分配置并重新索引？",
      content: `文档“${document.fileName}”将使用 ${payload.chunkSize}/${payload.chunkOverlap} 字符重新生成 Chunk。旧索引仅在新索引写入成功后替换。`,
      okText: "应用并重新索引",
      cancelText: "取消",
      onOk: async () => {
        try {
          const result = await actions.reindexMutation.mutateAsync({
            documentId: document.id,
            payload,
          });
          message.success(
            `重新索引完成，共 ${result.chunkCount ?? result.chunks ?? preview?.totalChunks ?? 0} 个 Chunk`,
          );
        } catch (error) {
          message.error(toApiError(error).message);
        }
      },
    });
  }

  return (
    <Drawer
      title={document ? `拆分配置：${document.fileName}` : "拆分配置"}
      open={open}
      width={720}
      onClose={onClose}
    >
      {document ? (
        <div className="grid gap-4">
          {actionBlocked ? (
            <Alert
              type="warning"
              showIcon
              title="文档正在处理中"
              description="当前状态不允许预览或再次重新索引，请稍后刷新重试。"
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            onValuesChange={() => {
              setPreview(null);
              setPreviewError(null);
            }}
          >
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="chunkSize"
                label="Chunk 大小（字符）"
                rules={[
                  { required: true, message: "请输入 Chunk 大小" },
                  { type: "number", min: 100, max: 4000, message: "请输入 100～4000" },
                ]}
              >
                <InputNumber className="w-full" min={100} max={4000} step={50} />
              </Form.Item>
              <Form.Item
                name="chunkOverlap"
                label="重叠大小（字符）"
                dependencies={["chunkSize"]}
                rules={[
                  { required: true, message: "请输入重叠大小" },
                  { type: "number", min: 0, max: 1000, message: "请输入 0～1000" },
                  ({ getFieldValue }) => ({
                    validator(_, value: number) {
                      const size = getFieldValue("chunkSize") as number;
                      return typeof value === "number" && typeof size === "number" && value >= size
                        ? Promise.reject(new Error("重叠大小必须小于 Chunk 大小"))
                        : Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber className="w-full" min={0} max={1000} step={10} />
              </Form.Item>
            </div>
            <Form.Item name="splitterType" label="拆分方式">
              <Select
                disabled
                options={[{ value: "recursive_character", label: "递归字符拆分" }]}
              />
            </Form.Item>
            <Space wrap>
              <Button
                onClick={loadPreview}
                loading={actions.previewMutation.isPending}
                disabled={actionBlocked || actions.reindexMutation.isPending}
              >
                预览拆分结果
              </Button>
              <Button
                type="primary"
                onClick={confirmReindex}
                loading={actions.reindexMutation.isPending}
                disabled={actionBlocked || actions.previewMutation.isPending}
              >
                应用配置并重新索引
              </Button>
            </Space>
          </Form>

          {previewError ? (
            <Alert type="error" showIcon title="拆分预览失败" description={previewError} />
          ) : null}
          {actions.previewMutation.isPending ? (
            <div className="flex min-h-32 items-center justify-center"><Spin /></div>
          ) : preview ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography.Title level={5} className="!mb-0">
                  拆分预览
                </Typography.Title>
                <Typography.Text type="secondary">
                  共 {preview.totalChunks} 个 Chunk，当前展示 {preview.items.length} 个
                </Typography.Text>
              </div>
              {preview.truncated ? (
                <Alert
                  type="warning"
                  showIcon
                  title="预览内容已截断"
                  description="为避免响应过大，仅展示前部分 Chunk；应用配置时仍会处理完整文档。"
                />
              ) : null}
              {preview.items.length ? preview.items.map((item) => (
                <Card
                  key={item.index}
                  size="small"
                  title={`Chunk #${item.index + 1}`}
                  extra={<Typography.Text type="secondary">{item.charCount} 字符</Typography.Text>}
                >
                  <Typography.Paragraph className="!mb-0 whitespace-pre-wrap break-words">
                    {item.content}
                  </Typography.Paragraph>
                </Card>
              )) : <Empty description="当前配置没有生成有效 Chunk" />}
            </div>
          ) : (
            <Empty description="调整参数后点击“预览拆分结果”" />
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

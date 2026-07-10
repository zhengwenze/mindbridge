"use client";

import { Alert, App, Button, Card, Form, Input, Space, Typography } from "antd";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import { useKnowledgeActions, useKnowledgeStatus } from "../hooks/use-knowledge-actions";

export function KnowledgeBasePanel() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const statusQuery = useKnowledgeStatus();
  const { uploadMutation, rebuildMutation, backupMutation } = useKnowledgeActions();
  const status = statusQuery.data;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }

    try {
      const result = await uploadMutation.mutateAsync(file);
      message.success(`${result.source ?? file.name} 已入库 ${result.chunks ?? 0} 个片段`);
      setFile(null);
      setFileInputKey((current) => current + 1);
      form.resetFields();
    } catch (error) {
      message.error(`上传失败：${toApiError(error).message}`);
    }
  }

  async function handleRebuild() {
    try {
      const result = await rebuildMutation.mutateAsync();
      message.success(`重建完成：${result.indexedChunks ?? 0} 个片段`);
    } catch (error) {
      message.error(`重建失败：${toApiError(error).message}`);
    }
  }

  async function handleBackup() {
    try {
      const result = await backupMutation.mutateAsync();
      message.success(`备份完成：${result.snapshot ?? "已生成快照"}`);
    } catch (error) {
      message.error(`备份失败：${toApiError(error).message}`);
    }
  }

  const vectorText = status?.vectorAvailable ? `向量 ${status.vectorChunks ?? 0}` : "向量不可用";

  return (
    <Card title="RAG 知识库维护" variant="outlined">
      <div className="grid gap-4">
        {statusQuery.isError ? (
          <Alert type="error" showIcon title="知识库状态读取失败" description={toApiError(statusQuery.error).message} />
        ) : (
          <Alert
            type={status?.vectorAvailable ? "success" : "warning"}
            showIcon
            title={
              statusQuery.isLoading
                ? "正在读取知识库状态"
                : `DB ${status?.databaseChunks ?? 0} 片段 · ${vectorText}`
            }
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label="知识库文件" extra="支持 PDF、Markdown、txt 文件">
            <Input
              key={fileInputKey}
              id="knowledge-file"
              type="file"
              accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
              onChange={handleFileChange}
            />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={uploadMutation.isPending}>
              上传入库
            </Button>
            <Button onClick={handleRebuild} loading={rebuildMutation.isPending}>
              重建向量索引
            </Button>
            <Button onClick={handleBackup} loading={backupMutation.isPending}>
              备份向量索引
            </Button>
          </Space>
        </Form>

        <Typography.Text type="secondary">
          上传、重建或备份成功后会自动刷新知识库状态。
        </Typography.Text>
      </div>
    </Card>
  );
}

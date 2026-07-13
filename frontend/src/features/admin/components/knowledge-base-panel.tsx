"use client";

import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import {
  useKnowledgeActions,
  useKnowledgeBase,
  useKnowledgeBases,
} from "../hooks/use-knowledge-actions";
import type {
  KnowledgeBase,
  KnowledgeBaseFilters,
  KnowledgeBasePayload,
  KnowledgeBaseReferenceDetail,
  KnowledgeBaseStatus,
} from "../types/admin-types";

const statuses: KnowledgeBaseStatus[] = [
  "active",
  "disabled",
  "indexing",
  "error",
  "DELETING",
  "DELETE_FAILED",
];
const statusLabels: Record<KnowledgeBaseStatus, string> = {
  active: "正常",
  disabled: "已停用",
  indexing: "索引中",
  error: "异常",
  DELETING: "删除中",
  DELETE_FAILED: "删除失败",
};
const statusColors: Record<KnowledgeBaseStatus, string> = {
  active: "success",
  disabled: "default",
  indexing: "processing",
  error: "error",
  DELETING: "processing",
  DELETE_FAILED: "error",
};
const referenceTypeLabels: Record<
  KnowledgeBaseReferenceDetail["type"],
  string
> = {
  agent: "Agent",
  application: "应用",
  department: "部门配置",
  running_task: "运行任务",
};

export function KnowledgeBasePanel() {
  const { message } = App.useApp();
  const [filters, setFilters] = useState<KnowledgeBaseFilters>({
    page: 1,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingId, setManagingId] = useState<number | null>(null);
  const [blockingReferences, setBlockingReferences] = useState<
    KnowledgeBaseReferenceDetail[]
  >([]);
  const [form] = Form.useForm<KnowledgeBasePayload>();
  const listQuery = useKnowledgeBases(filters);
  const detailQuery = useKnowledgeBase(managingId);
  const actions = useKnowledgeActions();

  const submitBase = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await actions.updateMutation.mutateAsync({
          id: editing.id,
          payload: values,
        });
        message.success("知识库已更新");
      } else {
        await actions.createMutation.mutateAsync({
          name: values.name ?? "",
          description: values.description ?? "",
        });
        message.success("知识库已创建");
      }
      setCreating(false);
      setEditing(null);
      form.resetFields();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(toApiError(error).message);
    }
  };

  const deleteBase = async (row: KnowledgeBase) => {
    try {
      await actions.deleteMutation.mutateAsync(row.id);
      message.success("知识库已删除");
    } catch (error) {
      const apiError = toApiError(error);
      const detail =
        apiError.details &&
        typeof apiError.details === "object" &&
        "detail" in apiError.details
          ? apiError.details.detail
          : null;
      if (
        apiError.status === 409 &&
        detail &&
        typeof detail === "object" &&
        "references" in detail &&
        Array.isArray(detail.references)
      ) {
        setBlockingReferences(
          detail.references as KnowledgeBaseReferenceDetail[],
        );
        return;
      }
      message.error(apiError.message);
    }
  };

  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: "知识库名称",
      dataIndex: "name",
      key: "name",
      width: 190,
      render: (name, row) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => setManagingId(row.id)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    { title: "文档", dataIndex: "documentCount", key: "documents", width: 78 },
    {
      title: "片段 / 向量",
      key: "chunks",
      width: 120,
      render: (_, row) =>
        `${row.chunkCount}${row.vectorCount === undefined ? "" : ` / ${row.vectorCount}`}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: KnowledgeBaseStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_, row) => (
        <Space size={4} wrap={false} className="whitespace-nowrap">
          <Button
            type="link"
            disabled={row.status === "DELETING"}
            onClick={() => {
              setEditing(row);
              form.setFieldsValue({
                name: row.name,
                description: row.description,
                status:
                  row.status === "active" || row.status === "disabled"
                    ? row.status
                    : undefined,
              });
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            disabled={row.status === "DELETING"}
            onClick={() => setManagingId(row.id)}
          >
            管理
          </Button>
          <Popconfirm
            title="确认删除该知识库？"
            description="系统会先检查引用；无引用时将永久删除 collection、文件和数据库记录。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteBase(row)}
          >
            <Button
              type="link"
              danger
              loading={actions.deleteMutation.isPending}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input.Search
          className="w-56"
          placeholder="按名称搜索"
          allowClear
          onSearch={(name) =>
            setFilters((current) => ({
              ...current,
              name: name || undefined,
              page: 1,
            }))
          }
        />
        <Select
          className="w-32"
          placeholder="全部状态"
          allowClear
          options={statuses.map((status) => ({
            value: status,
            label: statusLabels[status],
          }))}
          onChange={(status) =>
            setFilters((current) => ({ ...current, status, page: 1 }))
          }
        />
        <Input
          className="w-40"
          type="date"
          aria-label="创建开始日期"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              createdFrom: event.target.value || undefined,
              page: 1,
            }))
          }
        />
        <Input
          className="w-40"
          type="date"
          aria-label="创建结束日期"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              createdTo: event.target.value || undefined,
              page: 1,
            }))
          }
        />
        <Switch
          checked={Boolean(filters.includeDeleted)}
          onChange={(includeDeleted) =>
            setFilters((current) => ({ ...current, includeDeleted, page: 1 }))
          }
          checkedChildren="含已删除"
          unCheckedChildren="隐藏已删除"
        />
        <Button onClick={() => setFilters({ page: 1, pageSize: 20 })}>
          重置筛选
        </Button>
        <Button
          onClick={() => listQuery.refetch()}
          loading={listQuery.isFetching}
        >
          刷新
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setCreating(true);
            form.resetFields();
          }}
        >
          新建知识库
        </Button>
      </div>
      {listQuery.error ? (
        <Alert
          type="error"
          showIcon
          title="知识库列表读取失败"
          description={toApiError(listQuery.error).message}
          action={<Button onClick={() => listQuery.refetch()}>重试</Button>}
        />
      ) : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={listQuery.data?.items ?? []}
        loading={listQuery.isLoading}
        locale={{ emptyText: "暂无符合条件的知识库" }}
        pagination={{
          current: filters.page,
          pageSize: filters.pageSize,
          total: listQuery.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (page, pageSize) =>
            setFilters((current) => ({ ...current, page, pageSize })),
        }}
        scroll={{ x: 1200 }}
      />
      <Modal
        title={editing ? "编辑知识库" : "新建知识库"}
        open={creating || editing !== null}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={submitBase}
        confirmLoading={
          actions.createMutation.isPending || actions.updateMutation.isPending
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: "请输入知识库名称" }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label="知识库描述">
            <Input.TextArea rows={3} maxLength={4000} />
          </Form.Item>
          {editing ? (
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { value: "active", label: "正常" },
                  { value: "disabled", label: "已停用" },
                ]}
              />
            </Form.Item>
          ) : null}
          {editing ? (
            <Typography.Paragraph type="secondary">
              Collection：{editing.collectionName}
              <br />
              全局 Embedding 模型：qwen3-embedding:0.6b
              <br />
              创建时间：{new Date(editing.createdAt).toLocaleString()}
            </Typography.Paragraph>
          ) : null}
        </Form>
      </Modal>
      <Modal
        title="知识库正在被引用"
        open={blockingReferences.length > 0}
        footer={null}
        onCancel={() => setBlockingReferences([])}
      >
        <Typography.Paragraph>
          请先解除以下引用，再重新删除：
        </Typography.Paragraph>
        <div className="grid gap-2">
          {blockingReferences.map((reference) => (
            <Alert
              key={`${reference.type}-${reference.id}`}
              type="warning"
              showIcon
              title={`${referenceTypeLabels[reference.type]}：${reference.name || reference.id}`}
              description={`标识：${reference.id} · 状态：${reference.status}`}
            />
          ))}
        </div>
      </Modal>
      <KnowledgeDocumentDrawer
        id={managingId}
        base={detailQuery.data ?? null}
        loading={detailQuery.isLoading}
        onClose={() => setManagingId(null)}
      />
    </div>
  );
}

function KnowledgeDocumentDrawer({
  id,
  base,
  loading,
  onClose,
}: {
  id: number | null;
  base: KnowledgeBase | null;
  loading: boolean;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const actions = useKnowledgeActions();
  return (
    <Drawer
      title={base ? `管理文档：${base.name}` : "管理文档"}
      open={id !== null}
      width={520}
      onClose={onClose}
    >
      {loading ? <Typography.Text>正在读取知识库详情…</Typography.Text> : null}
      {base ? (
        <div className="grid gap-4">
          <Alert
            type={base.status === "active" ? "success" : "warning"}
            showIcon
            title={`状态：${statusLabels[base.status]}`}
            description={`文档 ${base.documentCount} · 片段 ${base.chunkCount} · 向量 ${base.vectorCount ?? 0} · ${base.collectionExists ? "collection 已就绪" : "collection 不存在"}`}
          />
          <Typography.Text type="secondary">
            上传和重建只影响当前知识库；文件将归属到“{base.name}”。
          </Typography.Text>
          <Input
            type="file"
            accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={base.status !== "active"}
          />
          <Space wrap>
            <Button
              type="primary"
              disabled={!file || base.status !== "active"}
              loading={actions.uploadMutation.isPending}
              onClick={() =>
                file &&
                actions.uploadMutation
                  .mutateAsync({ id: base.id, file })
                  .then((result) => {
                    message.success(
                      `${result.fileName} 已入库 ${result.chunks} 个片段`,
                    );
                    setFile(null);
                  })
                  .catch((error) => message.error(toApiError(error).message))
              }
            >
              上传到当前知识库
            </Button>
            <Button
              disabled={base.status !== "active"}
              loading={actions.rebuildMutation.isPending}
              onClick={() =>
                actions.rebuildMutation
                  .mutateAsync(base.id)
                  .then((result) =>
                    message.success(`已重建 ${result.indexedChunks} 个片段`),
                  )
                  .catch((error) => message.error(toApiError(error).message))
              }
            >
              重建当前索引
            </Button>
          </Space>
        </div>
      ) : null}
    </Drawer>
  );
}

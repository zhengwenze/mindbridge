"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Key } from "react";
import { useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import {
  useKnowledgeBases,
  useKnowledgeDocumentActions,
  useKnowledgeDocuments,
} from "../hooks/use-knowledge-actions";
import type {
  DocumentSortField,
  KnowledgeDocument,
  KnowledgeDocumentFilters,
} from "../types/admin-types";
import { DocumentSplitDrawer } from "./document-split-drawer";

const DEFAULT_FILTERS: KnowledgeDocumentFilters = {
  page: 1,
  pageSize: 20,
  sortBy: "created_at",
  sortOrder: "desc",
};

const documentStatuses = [
  { value: "active", label: "正常" },
  { value: "indexing", label: "索引中" },
  { value: "error", label: "异常" },
  { value: "deleting", label: "删除中" },
];

function statusTag(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active") return <Tag color="success">正常</Tag>;
  if (normalized === "indexing") return <Tag color="processing">索引中</Tag>;
  if (normalized === "error" || normalized === "delete_failed") return <Tag color="error">异常</Tag>;
  if (normalized === "deleting") return <Tag color="processing">删除中</Tag>;
  return <Tag>{status || "未知"}</Tag>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isActionBlocked(document: KnowledgeDocument) {
  const status = document.indexStatus.toLowerCase();
  return status === "indexing" || status === "deleting";
}

export function DocumentListPanel() {
  const { message, modal } = App.useApp();
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<number | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [filters, setFilters] = useState<KnowledgeDocumentFilters>(DEFAULT_FILTERS);
  const [searchName, setSearchName] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [splitDocument, setSplitDocument] = useState<KnowledgeDocument | null>(null);
  const basesQuery = useKnowledgeBases({
    name: knowledgeSearch || undefined,
    page: 1,
    pageSize: 100,
  });
  const documentsQuery = useKnowledgeDocuments(knowledgeBaseId, filters);
  const actions = useKnowledgeDocumentActions(knowledgeBaseId ?? 0);

  async function deleteOne(document: KnowledgeDocument) {
    setDeletingId(document.id);
    try {
      await actions.deleteMutation.mutateAsync(document.id);
      setSelectedRowKeys((current) => current.filter((key) => Number(key) !== document.id));
      message.success(`文档“${document.fileName}”已删除`);
    } catch (error) {
      message.error(toApiError(error).message);
    } finally {
      setDeletingId(null);
    }
  }

  function confirmBatchDelete() {
    if (knowledgeBaseId === null || selectedRowKeys.length === 0) return;
    if (selectedRowKeys.length > 100) {
      message.warning("一次最多删除 100 个文档");
      return;
    }
    const documentIds = selectedRowKeys.map(Number);
    modal.confirm({
      title: `确认删除选中的 ${documentIds.length} 个文档？`,
      content: "批量删除采用全成功或全失败语义，并会同步删除数据库 Chunk、向量索引和本地原文件。",
      okText: "批量删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await actions.batchDeleteMutation.mutateAsync(documentIds);
          setSelectedRowKeys([]);
          message.success(`已删除 ${documentIds.length} 个文档`);
        } catch (error) {
          message.error(toApiError(error).message);
        }
      },
    });
  }

  const sortOrderFor = (field: DocumentSortField) =>
    filters.sortBy === field ? (filters.sortOrder === "asc" ? "ascend" : "descend") : null;

  const columns: ColumnsType<KnowledgeDocument> = [
    {
      title: "文档名称",
      dataIndex: "fileName",
      key: "file_name",
      width: 240,
      sorter: true,
      sortOrder: sortOrderFor("file_name"),
      render: (value: string, row) => (
        <div className="min-w-0">
          <Typography.Text strong className="block truncate" title={value}>{value}</Typography.Text>
          <Typography.Text type="secondary" className="block truncate text-xs" title={row.relativePath}>
            {row.relativePath}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "大小",
      dataIndex: "fileSize",
      key: "file_size",
      width: 105,
      sorter: true,
      sortOrder: sortOrderFor("file_size"),
      render: (value: number) => formatFileSize(value),
    },
    {
      title: "上传时间",
      dataIndex: "createdAt",
      key: "created_at",
      width: 180,
      sorter: true,
      sortOrder: sortOrderFor("created_at"),
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "Chunk 数",
      dataIndex: "chunkCount",
      key: "chunk_count",
      width: 105,
      sorter: true,
      sortOrder: sortOrderFor("chunk_count"),
    },
    {
      title: "拆分配置",
      key: "splitConfig",
      width: 170,
      render: (_, row) => (
        <div>
          <Typography.Text>{row.chunkSize} / {row.chunkOverlap} 字符</Typography.Text>
          <Typography.Text type="secondary" className="block text-xs">递归字符拆分</Typography.Text>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "indexStatus",
      key: "index_status",
      width: 120,
      sorter: true,
      sortOrder: sortOrderFor("index_status"),
      render: (value: string, row) => (
        <div>
          {statusTag(value)}
          {row.errorMessage ? (
            <Typography.Text type="danger" className="block max-w-40 truncate text-xs" title={row.errorMessage}>
              {row.errorMessage}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, row) => (
        <Space size={4} wrap={false}>
          <Button
            type="link"
            disabled={isActionBlocked(row)}
            onClick={() => setSplitDocument(row)}
          >
            拆分配置
          </Button>
          <Popconfirm
            title="确认删除该文档？"
            description="将同步删除数据库 Chunk、向量索引和本地原文件，此操作不可撤销。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteOne(row)}
          >
            <Button
              type="link"
              danger
              disabled={isActionBlocked(row)}
              loading={deletingId === row.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleTableChange: TableProps<KnowledgeDocument>["onChange"] = (
    pagination,
    _tableFilters,
    sorter,
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const sortField = typeof activeSorter?.columnKey === "string"
      ? activeSorter.columnKey as DocumentSortField
      : filters.sortBy;
    setFilters((current) => ({
      ...current,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 20,
      sortBy: activeSorter?.order ? sortField : "created_at",
      sortOrder: activeSorter?.order === "ascend" ? "asc" : "desc",
    }));
  };

  return (
    <div className="grid gap-4">
      <Card title="选择知识库" variant="outlined">
        <div className="grid gap-2">
          <Select
            className="w-full max-w-xl"
            placeholder="搜索并选择知识库"
            showSearch
            filterOption={false}
            allowClear
            loading={basesQuery.isLoading}
            value={knowledgeBaseId}
            onSearch={setKnowledgeSearch}
            onChange={(value) => {
              setKnowledgeBaseId(value ?? null);
              setFilters(DEFAULT_FILTERS);
              setSearchName("");
              setSelectedRowKeys([]);
              setSplitDocument(null);
            }}
            options={(basesQuery.data?.items ?? []).map((base) => ({ value: base.id, label: base.name }))}
            notFoundContent={basesQuery.isLoading ? "正在读取…" : "没有匹配的知识库"}
          />
          <Typography.Text type="secondary">
            文档列表只读取 MySQL，不会为每一行实时请求向量库。
          </Typography.Text>
        </div>
      </Card>

      <Card title="文档列表" variant="outlined">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input.Search
              className="w-56"
              placeholder="按文档名称搜索"
              allowClear
              value={searchName}
              disabled={knowledgeBaseId === null}
              onChange={(event) => setSearchName(event.target.value)}
              onSearch={(name) => setFilters((current) => ({ ...current, name: name || undefined, page: 1 }))}
            />
            <Select
              className="w-32"
              placeholder="全部状态"
              allowClear
              disabled={knowledgeBaseId === null}
              value={filters.status}
              options={documentStatuses}
              onChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}
            />
            <Input
              className="w-40"
              type="date"
              aria-label="上传开始日期"
              disabled={knowledgeBaseId === null}
              value={filters.createdFrom ?? ""}
              onChange={(event) => setFilters((current) => ({
                ...current,
                createdFrom: event.target.value || undefined,
                page: 1,
              }))}
            />
            <Input
              className="w-40"
              type="date"
              aria-label="上传结束日期"
              disabled={knowledgeBaseId === null}
              value={filters.createdTo ?? ""}
              onChange={(event) => setFilters((current) => ({
                ...current,
                createdTo: event.target.value || undefined,
                page: 1,
              }))}
            />
            <Button
              disabled={knowledgeBaseId === null}
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setSearchName("");
              }}
            >
              重置筛选
            </Button>
            <Button
              disabled={knowledgeBaseId === null}
              loading={documentsQuery.isFetching}
              onClick={() => documentsQuery.refetch()}
            >
              刷新
            </Button>
            <Button
              danger
              disabled={!selectedRowKeys.length || actions.batchDeleteMutation.isPending}
              loading={actions.batchDeleteMutation.isPending}
              onClick={confirmBatchDelete}
            >
              批量删除（{selectedRowKeys.length}）
            </Button>
          </div>

          {documentsQuery.error ? (
            <Alert
              type="error"
              showIcon
              title="文档列表读取失败"
              description={toApiError(documentsQuery.error).message}
              action={<Button onClick={() => documentsQuery.refetch()}>重试</Button>}
            />
          ) : null}

          <Table<KnowledgeDocument>
            rowKey="id"
            columns={columns}
            dataSource={knowledgeBaseId === null ? [] : documentsQuery.data?.items ?? []}
            loading={documentsQuery.isLoading}
            locale={{ emptyText: knowledgeBaseId === null ? "请先选择知识库" : "暂无符合条件的文档" }}
            rowSelection={{
              selectedRowKeys,
              preserveSelectedRowKeys: true,
              getCheckboxProps: (row) => ({ disabled: isActionBlocked(row) }),
              onChange: (keys) => {
                if (keys.length > 100) {
                  message.warning("一次最多选择 100 个文档");
                  return;
                }
                setSelectedRowKeys(keys);
              },
            }}
            pagination={{
              current: filters.page,
              pageSize: filters.pageSize,
              total: documentsQuery.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `共 ${total} 个文档`,
            }}
            scroll={{ x: 1200 }}
            onChange={handleTableChange}
          />
        </div>
      </Card>

      {knowledgeBaseId !== null ? (
        <DocumentSplitDrawer
          knowledgeBaseId={knowledgeBaseId}
          document={splitDocument}
          open={splitDocument !== null}
          onClose={() => setSplitDocument(null)}
        />
      ) : null}
    </div>
  );
}

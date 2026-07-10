"use client";

import { Alert, Card, Empty, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";

import { toApiError } from "@/lib/api/api-error";

import type { AlertRecord, ExcelRecord } from "../types/admin-types";
import { formatDateTime } from "./admin-view-utils";

type RecordRow = ExcelRecord | AlertRecord;

interface AdminRecordTableProps {
  kind: "excel" | "alerts";
  records: RecordRow[];
  loading: boolean;
  error: unknown;
}

export function AdminRecordTable({ kind, records, loading, error }: AdminRecordTableProps) {
  const isExcel = kind === "excel";
  const title = isExcel ? "Excel 台账" : "预警记录";
  const description = isExcel
    ? "查看风险报告写入 Excel 台账的处理结果。"
    : "查看系统向咨询工作端发送的风险预警记录。";

  const columns: TableProps<RecordRow>["columns"] = isExcel
    ? [
        { title: "记录 ID", dataIndex: "id", key: "id", width: 110, render: (value) => `#${value ?? "—"}` },
        { title: "报告", dataIndex: "reportId", key: "reportId", width: 100, render: (value) => `#${value ?? "—"}` },
        {
          title: "状态",
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (value) => <Tag color={value === "SUCCESS" ? "success" : "warning"}>{value || "未知"}</Tag>
        },
        {
          title: "文件路径",
          dataIndex: "filePath",
          key: "filePath",
          ellipsis: true,
          render: (value) => value || "未记录"
        },
        { title: "处理说明", dataIndex: "message", key: "message", ellipsis: true, render: (value) => value || "—" },
        {
          title: "创建时间",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 180,
          render: (value) => formatDateTime(value)
        }
      ]
    : [
        { title: "记录 ID", dataIndex: "id", key: "id", width: 110, render: (value) => `#${value ?? "—"}` },
        { title: "报告", dataIndex: "reportId", key: "reportId", width: 100, render: (value) => `#${value ?? "—"}` },
        { title: "渠道", dataIndex: "channel", key: "channel", width: 120, render: (value) => value || "—" },
        { title: "接收方", dataIndex: "recipient", key: "recipient", ellipsis: true, render: (value) => value || "未配置" },
        {
          title: "状态",
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (value) => <Tag color={value === "SENT" ? "success" : "warning"}>{value || "未知"}</Tag>
        },
        { title: "预警内容", dataIndex: "message", key: "message", ellipsis: true, render: (value) => value || "—" },
        {
          title: "创建时间",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 180,
          render: (value) => formatDateTime(value)
        }
      ];

  return (
    <Card
      title={
        <div>
          <Typography.Title level={4} className="!mb-0">
            {title}
          </Typography.Title>
          <Typography.Text type="secondary" className="!text-xs">
            {description}
          </Typography.Text>
        </div>
      }
      extra={<Typography.Text type="secondary">共 {records.length} 条</Typography.Text>}
      variant="outlined"
    >
      {error ? (
        <Alert type="error" showIcon title={`${title}读取失败`} description={toApiError(error).message} />
      ) : records.length === 0 && !loading ? (
        <Empty description={`暂无${title}`} />
      ) : (
        <Table<RecordRow>
          rowKey={(record) => String(record.id ?? `${record.reportId}-${record.createdAt}`)}
          loading={loading}
          columns={columns}
          dataSource={records}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: isExcel ? 900 : 1100 }}
          size="middle"
        />
      )}
    </Card>
  );
}

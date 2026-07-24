"use client";

import { ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Select, Typography } from "antd";

import type { RiskCaseFilters, RiskCaseStatus, RiskLevelFilter } from "../types/admin-types";

interface RiskCaseFiltersProps {
  filters: RiskCaseFilters;
  loading: boolean;
  onChange: (filters: RiskCaseFilters) => void;
  onRefresh: () => void;
}

const riskOptions: Array<{ value: RiskLevelFilter; label: string }> = [
  { value: "HIGH", label: "高风险" },
  { value: "MEDIUM", label: "中风险" },
  { value: "LOW", label: "低风险" }
];

const statusOptions: Array<{ value: RiskCaseStatus; label: string }> = [
  { value: "OPEN", label: "待跟进" },
  { value: "ALERT_SENT", label: "预警已发送" },
  { value: "ACKNOWLEDGED", label: "已确认" }
];

export function RiskCaseFiltersBar({ filters, loading, onChange, onRefresh }: RiskCaseFiltersProps) {
  const hasFilters = Boolean(filters.riskLevel || filters.status);

  function update(values: Partial<RiskCaseFilters>) {
    onChange({ ...filters, ...values, page: 1 });
  }

  return (
    <Card variant="outlined" styles={{ body: { padding: 16 } }}>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[180px_200px_auto_auto_minmax(0,1fr)]">
        <label className="grid gap-1">
          <Typography.Text type="secondary" className="!text-xs">风险等级</Typography.Text>
          <Select<RiskLevelFilter>
            aria-label="按风险等级筛选"
            placeholder="全部风险等级"
            allowClear
            value={filters.riskLevel}
            options={riskOptions}
            onChange={(riskLevel) => update({ riskLevel })}
          />
        </label>
        <label className="grid gap-1">
          <Typography.Text type="secondary" className="!text-xs">处理状态</Typography.Text>
          <Select<RiskCaseStatus>
            aria-label="按处理状态筛选"
            placeholder="全部处理状态"
            allowClear
            value={filters.status}
            options={statusOptions}
            onChange={(status) => update({ status })}
          />
        </label>
        <Button
          disabled={!hasFilters}
          onClick={() => onChange({ page: 1, pageSize: filters.pageSize })}
        >
          重置筛选
        </Button>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          刷新
        </Button>
      </div>
    </Card>
  );
}

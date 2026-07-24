"use client";

import {
  AlertOutlined,
  BellOutlined,
  CalendarOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import { Card, Statistic, Typography } from "antd";

import type { AdminOverviewData } from "../types/admin-types";

interface AdminMetricsProps {
  overview?: AdminOverviewData;
  loading: boolean;
}

export function AdminMetrics({ overview, loading }: AdminMetricsProps) {
  const days = overview?.periodDays ?? 30;
  const items = [
    {
      key: "totalReports",
      label: "累计报告",
      value: overview?.summary.totalReports ?? 0,
      hint: "系统累计生成的心理支持报告",
      icon: FileTextOutlined,
      tone: "blue"
    },
    {
      key: "periodReports",
      label: `近 ${days} 日新增`,
      value: overview?.summary.periodReports ?? 0,
      hint: "所选统计周期内新增报告",
      icon: CalendarOutlined,
      tone: "teal"
    },
    {
      key: "todayReports",
      label: "今日新增",
      value: overview?.summary.todayReports ?? 0,
      hint: "今天新生成的报告",
      icon: CalendarOutlined,
      tone: "amber"
    },
    {
      key: "periodHighRiskRate",
      label: "高风险占比",
      value: overview?.summary.periodHighRiskRate ?? 0,
      suffix: "%",
      hint: `近 ${days} 日共 ${overview?.summary.periodHighRiskReports ?? 0} 份高风险报告`,
      icon: AlertOutlined,
      tone: "red"
    },
    {
      key: "alertSuccessRate",
      label: "预警成功率",
      value: overview?.processing.alertTotal ? overview.processing.alertSuccessRate : "—",
      suffix: overview?.processing.alertTotal ? "%" : undefined,
      hint: overview?.processing.alertTotal
        ? `近 ${days} 日成功 ${overview.processing.alertSuccess} 次`
        : `近 ${days} 日暂无预警记录`,
      icon: BellOutlined,
      tone: "green"
    }
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} variant="outlined" loading={loading} className={`metric-card metric-card-${item.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Typography.Text type="secondary" className="!text-sm">
                  {item.label}
                </Typography.Text>
                <Statistic value={item.value} suffix={"suffix" in item ? item.suffix : undefined} className="metric-stat" />
              </div>
              <span className="metric-icon" aria-hidden="true">
                <Icon />
              </span>
            </div>
            <Typography.Text type="secondary" className="mt-3 block !text-xs">
              {item.hint}
            </Typography.Text>
          </Card>
        );
      })}
    </div>
  );
}

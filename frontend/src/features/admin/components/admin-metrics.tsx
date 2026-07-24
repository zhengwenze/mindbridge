"use client";

import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  FileExcelOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import { Card, Statistic, Typography } from "antd";

interface AdminMetricsProps {
  metrics: {
    reportCount: number;
    highRiskCount: number;
    caseCount: number;
    excelRecordCount: number;
    alertCount: number;
  };
  loading: boolean;
}

const metricItems = [
  { key: "reportCount", label: "报告数", hint: "已生成的心理风险与咨询报告", icon: FileTextOutlined, tone: "blue" },
  { key: "highRiskCount", label: "高风险", hint: "需要优先关注的报告", icon: AlertOutlined, tone: "red" },
  { key: "caseCount", label: "个案数", hint: "已进入跟进流程的风险个案", icon: AuditOutlined, tone: "amber" },
  { key: "excelRecordCount", label: "Excel 台账", hint: "已写入台账的记录", icon: FileExcelOutlined, tone: "green" },
  { key: "alertCount", label: "预警记录", hint: "通知渠道产生的发送记录", icon: AppstoreOutlined, tone: "purple" }
] as const;

export function AdminMetrics({ metrics, loading }: AdminMetricsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metricItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} variant="outlined" loading={loading} className={`metric-card metric-card-${item.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Typography.Text type="secondary" className="!text-sm">
                  {item.label}
                </Typography.Text>
                <Statistic value={metrics[item.key]} className="metric-stat" />
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

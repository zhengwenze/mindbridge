"use client";

import { Card, Col, Row, Statistic } from "antd";

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
  { key: "reportCount", label: "报告数" },
  { key: "highRiskCount", label: "高风险" },
  { key: "caseCount", label: "个案数" },
  { key: "excelRecordCount", label: "Excel 台账" },
  { key: "alertCount", label: "预警记录" }
] as const;

export function AdminMetrics({ metrics, loading }: AdminMetricsProps) {
  return (
    <Row gutter={[12, 12]}>
      {metricItems.map((item) => (
        <Col key={item.key} xs={24} sm={12} lg={8} xl={4}>
          <Card variant="outlined" loading={loading}>
            <Statistic title={item.label} value={metrics[item.key]} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

"use client";

import { Card, Empty, Progress, Skeleton, Typography } from "antd";

import type {
  AdminOverviewData,
  AdminOverviewRiskDistributionItem,
  AdminOverviewTrendPoint
} from "../types/admin-types";

interface AdminOverviewInsightsProps {
  overview?: AdminOverviewData;
  loading: boolean;
}

const riskPresentation = {
  HIGH: { label: "高风险", color: "#dc2626" },
  MEDIUM: { label: "中风险", color: "#f59e0b" },
  LOW: { label: "低风险", color: "#16a34a" }
} as const;

function CardHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <Typography.Title level={4} className="!mb-0">
        {title}
      </Typography.Title>
      <Typography.Text type="secondary" className="!text-xs">
        {description}
      </Typography.Text>
    </div>
  );
}

function ReportTrendChart({ points }: { points: AdminOverviewTrendPoint[] }) {
  const width = 760;
  const height = 250;
  const padding = { top: 16, right: 16, bottom: 38, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(1, ...points.map((point) => point.total));
  const x = (index: number) => (
    padding.left + (points.length <= 1 ? chartWidth / 2 : index * chartWidth / (points.length - 1))
  );
  const y = (value: number) => padding.top + chartHeight - value * chartHeight / maximum;
  const totalPoints = points.map((point, index) => `${x(index)},${y(point.total)}`).join(" ");
  const highPoints = points.map((point, index) => `${x(index)},${y(point.high)}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" />
          每日报告
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600" aria-hidden="true" />
          高风险报告
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[250px] min-w-[680px] w-full"
          role="img"
          aria-label="每日新增报告与高风险报告变化趋势"
        >
          {[0, 0.5, 1].map((ratio) => {
            const gridY = padding.top + chartHeight * ratio;
            const value = Math.round(maximum * (1 - ratio));
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={gridY}
                  y2={gridY}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text x={padding.left - 8} y={gridY + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {value}
                </text>
              </g>
            );
          })}
          <polyline points={totalPoints} fill="none" stroke="#12847f" strokeWidth="3" strokeLinejoin="round" />
          <polyline points={highPoints} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={point.date}>
              <circle cx={x(index)} cy={y(point.total)} r="3.5" fill="#12847f">
                <title>{`${point.date}：报告 ${point.total} 份，高风险 ${point.high} 份`}</title>
              </circle>
              {(index % labelStep === 0 || index === points.length - 1) ? (
                <text
                  x={x(index)}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {point.date.slice(5).replace("-", "/")}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function RiskDistribution({ items }: { items: AdminOverviewRiskDistributionItem[] }) {
  const values = new Map(items.map((item) => [item.riskLevel, item]));
  return (
    <div className="grid gap-4">
      {(["HIGH", "MEDIUM", "LOW"] as const).map((riskLevel) => {
        const item = values.get(riskLevel);
        const presentation = riskPresentation[riskLevel];
        return (
          <div key={riskLevel}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <Typography.Text strong>{presentation.label}</Typography.Text>
              <Typography.Text type="secondary">
                {item?.count ?? 0} 份 · {item?.percentage ?? 0}%
              </Typography.Text>
            </div>
            <Progress
              percent={item?.percentage ?? 0}
              showInfo={false}
              strokeColor={presentation.color}
              trailColor="#e2e8f0"
              size="small"
            />
          </div>
        );
      })}
    </div>
  );
}

function ProcessingRow({
  label,
  success,
  failed,
  total
}: {
  label: string;
  success: number;
  failed: number;
  total: number;
}) {
  const successRate = total > 0 ? Math.round(success * 1000 / total) / 10 : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Typography.Text strong>{label}</Typography.Text>
        <Typography.Text type="secondary">{total > 0 ? `${successRate}% 成功` : "暂无记录"}</Typography.Text>
      </div>
      {total > 0 ? (
        <>
          <Progress percent={successRate} showInfo={false} strokeColor="#12847f" trailColor="#e2e8f0" size="small" />
          <Typography.Text type="secondary" className="mt-1 block !text-xs">
            成功 {success} 条 · 失败 {failed} 条 · 共 {total} 条
          </Typography.Text>
        </>
      ) : (
        <Typography.Text type="secondary" className="block !text-xs">
          当前统计周期内没有处理记录
        </Typography.Text>
      )}
    </div>
  );
}

export function AdminOverviewInsights({ overview, loading }: AdminOverviewInsightsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <Card variant="outlined"><Skeleton active paragraph={{ rows: 8 }} /></Card>
        <div className="grid gap-4">
          <Card variant="outlined"><Skeleton active paragraph={{ rows: 4 }} /></Card>
          <Card variant="outlined"><Skeleton active paragraph={{ rows: 3 }} /></Card>
        </div>
      </div>
    );
  }

  const hasPeriodReports = Boolean(overview?.summary.periodReports);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <Card
        title={<CardHeading title="报告变化趋势" description={`近 ${overview?.periodDays ?? 30} 日每日新增报告量`} />}
        variant="outlined"
        className="h-full"
      >
        {hasPeriodReports && overview ? (
          <ReportTrendChart points={overview.dailyTrend} />
        ) : (
          <Empty description="统计周期内暂无报告数据" />
        )}
      </Card>
      <div className="grid gap-4">
        <Card
          title={<CardHeading title="风险等级分布" description={`近 ${overview?.periodDays ?? 30} 日报告构成`} />}
          variant="outlined"
        >
          {hasPeriodReports && overview ? (
            <RiskDistribution items={overview.riskDistribution} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无风险分布数据" />
          )}
        </Card>
        <Card
          title={<CardHeading title="自动化处理概况" description={`近 ${overview?.periodDays ?? 30} 日任务结果`} />}
          variant="outlined"
        >
          <div className="grid gap-4">
            <ProcessingRow
              label="Excel 台账"
              success={overview?.processing.excelSuccess ?? 0}
              failed={overview?.processing.excelFailed ?? 0}
              total={overview?.processing.excelTotal ?? 0}
            />
            <ProcessingRow
              label="预警发送"
              success={overview?.processing.alertSuccess ?? 0}
              failed={overview?.processing.alertFailed ?? 0}
              total={overview?.processing.alertTotal ?? 0}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

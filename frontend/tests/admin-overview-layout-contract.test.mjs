import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../src/features/admin/components/${relativePath}`, import.meta.url), "utf8");
}

test("admin overview contains aggregate data only and keeps card spacing uniform", async () => {
  const overview = await source("admin-section-pages.tsx");
  const metrics = await source("admin-metrics.tsx");
  const insights = await source("admin-overview-insights.tsx");
  const overviewSection = overview.slice(
    overview.indexOf("export function AdminOverviewPage"),
    overview.indexOf("export function AdminCasesPage")
  );

  assert.doesNotMatch(overviewSection, /RiskCasesPanel|dashboard\.cases|casesQuery|待跟进风险个案/);
  assert.match(overviewSection, /useAdminOverview\(30\)/);
  assert.match(overviewSection, /<AdminOverviewInsights/);
  assert.match(overviewSection, /className="grid gap-4"/);
  assert.match(metrics, /className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"/);
  assert.match(insights, /报告变化趋势/);
  assert.match(insights, /风险等级分布/);
  assert.match(insights, /自动化处理概况/);
  assert.match(insights, /HIGH/);
  assert.match(insights, /MEDIUM/);
  assert.match(insights, /LOW/);
  assert.match(insights, /overflow-x-auto/);
  assert.match(insights, /min-w-\[680px\]/);
  assert.match(insights, /暂无记录/);
  assert.match(overview, /重新加载/);
  assert.match(overviewSection, /overviewQuery\.refetch\(\)/);
  assert.doesNotMatch(insights, /handoffSummary|owner|个案 #/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../src/features/admin/${relativePath}`, import.meta.url), "utf8");
}

test("risk case filters cover every risk level and processing status", async () => {
  const filters = await source("components/risk-case-filters.tsx");
  const page = await source("components/admin-section-pages.tsx");

  for (const value of ["HIGH", "MEDIUM", "LOW", "OPEN", "ALERT_SENT", "ACKNOWLEDGED"]) {
    assert.match(filters, new RegExp(`"${value}"`));
  }
  assert.match(filters, /全部风险等级/);
  assert.match(filters, /全部处理状态/);
  assert.match(filters, /page: 1/);
  assert.match(page, /useAdminCases\(filters\)/);
  assert.match(page, /暂无符合当前筛选条件的个案/);
});

test("risk case API filters before server pagination", async () => {
  const api = await source("api/admin-api.ts");
  const hook = await source("hooks/use-admin-dashboard.ts");

  assert.match(api, /params\.set\("risk_level", filters\.riskLevel\)/);
  assert.match(api, /params\.set\("status", filters\.status\)/);
  assert.match(api, /params\.set\("page", String\(filters\.page\)\)/);
  assert.match(api, /params\.set\("page_size", String\(filters\.pageSize\)\)/);
  assert.match(hook, /queryKey: adminQueryKeys\.cases\(filters\)/);
});

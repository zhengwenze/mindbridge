import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../src/features/admin/components/${relativePath}`, import.meta.url), "utf8");
}

test("admin overview removes usage guidance and keeps card spacing uniform", async () => {
  const overview = await source("admin-section-pages.tsx");
  const metrics = await source("admin-metrics.tsx");
  const overviewSection = overview.slice(
    overview.indexOf("export function AdminOverviewPage"),
    overview.indexOf("export function AdminCasesPage")
  );

  assert.doesNotMatch(overviewSection, /后台使用提示|先看高风险|数据范围/);
  assert.match(overviewSection, /className="grid gap-4"/);
  assert.doesNotMatch(overviewSection, /xl:grid-cols/);
  assert.match(metrics, /className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"/);
});

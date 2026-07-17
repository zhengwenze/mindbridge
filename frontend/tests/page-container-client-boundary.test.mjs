import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const pageContainerUrl = new URL(
  "../src/components/layout/page-container.tsx",
  import.meta.url,
);

test("PageContainer stays inside a client boundary", async () => {
  const source = await readFile(pageContainerUrl, "utf8");

  assert.match(
    source,
    /^"use client";/,
    "PageContainer renders Ant Design compound components and must remain a client component",
  );
});

test("admin pages omit redundant page-level descriptions", async () => {
  const sources = await Promise.all([
    readFile(
      new URL(
        "../src/features/admin/components/admin-section-pages.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/admin/docs/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /<PageContainer[^>]*description=/s);
    const pageContainers = source.match(/<PageContainer\b/g) ?? [];
    const hiddenHeaders = source.match(/<PageContainer\b[^>]*\bhideHeader\b[^>]*>/gs) ?? [];
    assert.equal(hiddenHeaders.length, pageContainers.length);
  }
});

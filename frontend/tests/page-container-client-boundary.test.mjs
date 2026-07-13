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

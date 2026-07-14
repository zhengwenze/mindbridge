import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("document workspace keeps upload and management as separate tabs", async () => {
  const workspace = await source(
    "src/features/admin/components/document-management-workspace.tsx",
  );
  assert.match(workspace, /label: "上传文档"/);
  assert.match(workspace, /label: "文档管理"/);
  assert.match(workspace, /<DocumentUploadPanel \/>/);
  assert.match(workspace, /<DocumentListPanel \/>/);
});

test("custom character split settings preserve the existing upload pipeline", async () => {
  const api = await source("src/features/admin/api/admin-api.ts");
  const upload = await source(
    "src/features/admin/components/document-upload-panel.tsx",
  );
  assert.match(api, /formData\.append\("relative_path", relativePath\)/);
  assert.match(api, /formData\.append\("chunk_size", String\(splitOptions\.chunkSize\)\)/);
  assert.match(api, /formData\.append\("chunk_overlap", String\(splitOptions\.chunkOverlap\)\)/);
  assert.match(api, /formData\.append\("splitter_type", splitOptions\.splitterType\)/);
  assert.match(upload, /Math\.min\(2, pending\.length\)/, "double concurrency must remain intact");
  assert.match(upload, /directory/, "folder uploads must remain available");
  assert.match(upload, /重试/, "per-file retry must remain available");
  assert.match(upload, /Chunk 大小（字符）/);
  assert.match(upload, /重叠大小（字符）/);
});

test("document management exposes server filters, deletion and split lifecycle", async () => {
  const api = await source("src/features/admin/api/admin-api.ts");
  const list = await source(
    "src/features/admin/components/document-list-panel.tsx",
  );
  const drawer = await source(
    "src/features/admin/components/document-split-drawer.tsx",
  );
  const hooks = await source(
    "src/features/admin/hooks/use-knowledge-actions.ts",
  );

  for (const parameter of [
    "created_from",
    "created_to",
    "page_size",
    "sort_by",
    "sort_order",
  ]) {
    assert.match(api, new RegExp(`params\\.set\\(\"${parameter}\"`));
  }
  assert.match(api, /createdTo\}T23:59:59\.999/, "end-date filtering must include the full selected day");
  assert.match(api, /documents\/\$\{documentId\}\/split-preview/);
  assert.match(api, /documents\/\$\{documentId\}\/reindex/);
  assert.match(api, /documents\/batch-delete/);
  assert.match(list, /<Table<KnowledgeDocument>/);
  assert.match(list, /rowSelection=/);
  assert.match(list, /<Popconfirm/);
  assert.match(list, /批量删除采用全成功或全失败语义/);
  assert.match(drawer, /whitespace-pre-wrap/);
  assert.match(drawer, /preview\.truncated/);
  assert.match(drawer, /应用配置并重新索引/);
  assert.match(hooks, /invalidateQueries\(\{ queryKey: knowledgeQueryKeys\.documents/);
  assert.match(hooks, /invalidateQueries\(\{ queryKey: knowledgeQueryKeys\.bases/);
});

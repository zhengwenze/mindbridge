import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source() {
  return readFile(new URL("../src/features/chat/components/markdown-message.tsx", import.meta.url), "utf8");
}

test("assistant markdown renderer covers required GFM elements and avoids raw HTML", async () => {
  const content = await source();
  for (const element of ["h1", "h2", "h3", "ul", "ol", "li", "strong", "blockquote", "code", "pre", "table"]) {
    assert.match(content, new RegExp(`\\b${element}:`));
  }
  assert.match(content, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.doesNotMatch(content, /rehypeRaw|rehype-raw|dangerouslySetInnerHTML/);
  assert.match(content, /noopener noreferrer/);
});

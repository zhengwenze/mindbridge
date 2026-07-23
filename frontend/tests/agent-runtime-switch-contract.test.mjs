import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("admin sidebar links to runtime switch after user management", async () => {
  const sidebar = await source(
    "src/components/layout/sidebar-placeholder.tsx",
  );
  const usersPosition = sidebar.indexOf('key: "/admin/users"');
  const runtimePosition = sidebar.indexOf('key: "/admin/runtime"');
  const logsPosition = sidebar.indexOf('key: "/admin/logs"');

  assert.ok(usersPosition >= 0, "user management menu item must exist");
  assert.ok(runtimePosition > usersPosition, "runtime switch must follow user management");
  assert.ok(logsPosition > runtimePosition, "runtime switch must precede logs");
  assert.match(sidebar, /label: "运行切换"/);
  assert.match(sidebar, /<SwapOutlined \/>/);
});

test("runtime route stays inside the compact admin page boundary", async () => {
  const page = await source("src/app/admin/runtime/page.tsx");

  assert.match(page, /<PageContainer title="运行切换" hideHeader>/);
  assert.doesNotMatch(page, /<PageContainer[^>]*description=/s);
  assert.match(page, /<AgentRuntimeSwitchPanel \/>/);
});

test("runtime API and React Query hook keep the management contract", async () => {
  const api = await source("src/features/admin/api/admin-api.ts");
  const hook = await source("src/features/admin/hooks/use-agent-runtime.ts");

  assert.match(api, /get<AgentRuntimeConfig>\("\/api\/admin\/agent-runtime"\)/);
  assert.match(api, /patch<AgentRuntimeConfig>\(/);
  assert.match(api, /"\/api\/admin\/agent-runtime",\s*payload/s);
  assert.match(hook, /queryKey: agentRuntimeQueryKeys\.config/);
  assert.match(
    hook,
    /invalidateQueries\(\{\s*queryKey: systemStatusQueryKeys\.agentStatus/s,
  );
});

test("runtime panel covers all switch states and confirmation behavior", async () => {
  const panel = await source(
    "src/features/admin/components/agent-runtime-switch-panel.tsx",
  );

  assert.match(panel, /event_driven_multi_agent: "事件驱动多智能体"/);
  assert.match(panel, /langgraph: "LangGraph"/);
  assert.match(panel, /custom: "Custom"/);
  assert.match(panel, /<Tag color="blue">默认<\/Tag>/);
  assert.match(panel, /基础 \/ 应急方式/);
  assert.match(panel, /disabled=\{!option\.available\}/);
  assert.match(panel, /运行配置读取失败/);
  assert.match(panel, /<Skeleton active/);
  assert.match(panel, /从下一轮新对话生效，当前流式回复不受影响/);
  assert.match(panel, /disabled=\{!canSubmit\}/);
  assert.match(panel, /setSelectedFramework\(config\.currentFramework\)/);
  assert.match(panel, /message\.success/);
  assert.match(panel, /message\.error/);
});

# MindBridge 新版前端管理员核心功能迁移清单

> 状态（2026-07-21）：迁移已完成，保留为历史核对清单。现役前端结构以 [`architecture.md`](architecture.md)、[`coding-rules.md`](coding-rules.md) 和 `frontend/src/` 为准。

## 已阅读范围

旧版前端参考文件：

- `app/static/student.html`
- `app/static/student.js`
- `app/static/admin.html`
- `app/static/admin.js`
- `app/static/styles.css`

新版前端结构：

- `frontend/src/app`
- `frontend/src/features/auth`
- `frontend/src/features/chat`
- `frontend/src/lib`
- `frontend/src/components`
- `frontend/src/stores`

备注：当前仓库没有 `frontend/src/shared` 目录。现有公共能力主要在 `frontend/src/lib`、`frontend/src/components` 和 `frontend/src/stores`。

## 当前新版进度判断

已完成：

- Next.js App Router 基础结构。
- Ant Design、Tailwind、React Query、Zustand 基础集成。
- Basic Auth 登录，调用 `GET /api/profile`。
- 登录后按角色跳转 `/student` 或 `/admin`。
- 学生/管理员路由守卫。
- 学生端 SSE 聊天，调用 `POST /api/chat/stream`。
- `/api/*` 与 `/actuator/*` 通过 `next.config.ts` 代理到后端。

未完成或未恢复：

- 管理员端 `/admin` 仍是占位页。
- 全局服务健康状态未展示。
- 全局模型状态未展示。
- 管理员 reports、cases、excel-records、alerts、conversation、knowledge 功能未迁移。
- 管理员侧边栏仍有 disabled 占位项。
- 学生端快捷按钮已迁移数据，但展示文案比旧版粗糙。

## 旧版接口清单

### 认证与角色

| 旧版位置                           | 方法 | 接口           | 用途                                | 新版状态                                 |
| ---------------------------------- | ---- | -------------- | ----------------------------------- | ---------------------------------------- |
| `app.js`、`student.js`、`admin.js` | GET  | `/api/profile` | 校验 Basic Auth，获取用户信息和角色 | 已封装在 `features/auth/api/auth-api.ts` |

### 全局状态

| 旧版位置                           | 方法 | 接口                | 用途                                   | 新版状态 |
| ---------------------------------- | ---- | ------------------- | -------------------------------------- | -------- |
| `student.js`、`admin.js`、`app.js` | GET  | `/actuator/health`  | 展示服务 UP/DOWN                       | 未迁移   |
| `student.js`、`admin.js`           | GET  | `/api/agent/status` | 展示 provider、model、realModelEnabled | 未迁移   |

### 学生聊天

| 旧版位置     | 方法 | 接口               | 用途                                           | 新版状态                 |
| ------------ | ---- | ------------------ | ---------------------------------------------- | ------------------------ |
| `student.js` | POST | `/api/chat/stream` | SSE 流式聊天，body 为 `{ sessionId, message }` | 已迁移到 `features/chat` |

### 管理员核心看板

| 旧版位置   | 方法 | 接口                       | 用途                           | 新版状态 |
| ---------- | ---- | -------------------------- | ------------------------------ | -------- |
| `admin.js` | GET  | `/api/admin/reports`       | 风险报告列表、报告数、高风险数 | 未迁移   |
| `admin.js` | GET  | `/api/admin/cases`         | 风险个案列表、个案数           | 未迁移   |
| `admin.js` | GET  | `/api/admin/excel-records` | Excel 台账数量                 | 未迁移   |
| `admin.js` | GET  | `/api/admin/alerts`        | 预警记录数量                   | 未迁移   |

### 管理员会话档案

| 旧版位置   | 方法 | 接口                                   | 用途                       | 新版状态 |
| ---------- | ---- | -------------------------------------- | -------------------------- | -------- |
| `admin.js` | GET  | `/api/admin/conversations/{sessionId}` | 点击报告后只读展示历史消息 | 未迁移   |

### 管理员知识库

| 旧版位置   | 方法 | 接口                                  | 用途                                            | 新版状态 |
| ---------- | ---- | ------------------------------------- | ----------------------------------------------- | -------- |
| `admin.js` | GET  | `/api/admin/knowledge/status`         | 展示 DB 片段数、向量索引可用性、向量片段数      | 未迁移   |
| `admin.js` | POST | `/api/admin/knowledge/file`           | 上传 PDF、Markdown、txt，FormData 字段名 `file` | 未迁移   |
| `admin.js` | POST | `/api/admin/knowledge/rebuild-vector` | 重建向量索引                                    | 未迁移   |
| `admin.js` | POST | `/api/admin/knowledge/backup`         | 备份向量索引                                    | 未迁移   |

## 新版迁移落点

### 1. 全局状态恢复

新增 API：

- `frontend/src/features/system/api/system-api.ts`
  - `fetchHealth() -> GET /actuator/health`
  - `fetchAgentStatus() -> GET /api/agent/status`

新增 hooks：

- `frontend/src/features/system/hooks/use-system-status.ts`
  - 用 React Query 并行读取健康状态和模型状态。
  - 允许在 Header 中展示轻量错误态。

新增组件：

- `frontend/src/components/layout/global-status-indicators.tsx`
  - 展示“服务正常 / 服务 DOWN”。
  - 展示“provider / model”或“mock 演示”。
  - 复用旧版 `displayModel` 规则：包含 `mindbridge-qwen2.5-7b-ft` 时显示“微调 Qwen2.5-7B”。

修改页面位置：

- `frontend/src/components/layout/global-header.tsx`
  - 在用户信息和退出按钮附近恢复服务状态、模型状态。

### 2. 管理员 API 与类型

新增类型：

- `frontend/src/features/admin/types/admin-types.ts`
  - `RiskReport`
  - `RiskCase`
  - `ExcelRecord`
  - `AlertRecord`
  - `ConversationArchive`
  - `ConversationMessage`
  - `KnowledgeStatus`
  - `KnowledgeUploadResult`
  - `KnowledgeRebuildResult`
  - `KnowledgeBackupResult`

新增 API：

- `frontend/src/features/admin/api/admin-api.ts`
  - `fetchAdminReports() -> GET /api/admin/reports`
  - `fetchAdminCases() -> GET /api/admin/cases`
  - `fetchExcelRecords() -> GET /api/admin/excel-records`
  - `fetchAlerts() -> GET /api/admin/alerts`
  - `fetchConversation(sessionId) -> GET /api/admin/conversations/{sessionId}`
  - `fetchKnowledgeStatus() -> GET /api/admin/knowledge/status`
  - `uploadKnowledgeFile(file) -> POST /api/admin/knowledge/file`
  - `rebuildKnowledgeVector() -> POST /api/admin/knowledge/rebuild-vector`
  - `backupKnowledgeVector() -> POST /api/admin/knowledge/backup`

实现要求：

- 继续使用现有 `apiClient`，不要绕过认证拦截器。
- 文件上传使用 `FormData`，字段名必须保持为 `file`。
- 不改任何 endpoint、method、body 字段。

### 3. 管理员 hooks

新增 hooks：

- `frontend/src/features/admin/hooks/use-admin-dashboard.ts`
  - 并行读取 reports、cases、excel-records、alerts。
  - 计算指标：报告数、高风险数、个案数、Excel 台账数、预警记录数。

- `frontend/src/features/admin/hooks/use-admin-conversation.ts`
  - 按 `sessionId` 懒加载会话档案。
  - 支持选择报告后高亮当前报告。

- `frontend/src/features/admin/hooks/use-knowledge-status.ts`
  - 读取知识库状态。
  - 上传、重建、备份成功后刷新状态。

- `frontend/src/features/admin/hooks/use-knowledge-actions.ts`
  - 封装上传文件、重建向量索引、备份向量索引 mutation。

### 4. 管理员组件

新增页面级组件：

- `frontend/src/features/admin/components/admin-dashboard.tsx`
  - 替换当前 `/admin` 占位页。
  - 组合指标、个案、报告、会话档案、知识库模块。

新增展示组件：

- `frontend/src/features/admin/components/admin-metrics.tsx`
  - 对应旧版 `.admin-grid` 五个指标。

- `frontend/src/features/admin/components/risk-cases-panel.tsx`
  - 对应旧版 `renderCases(cases)`。
  - 展示 `id`、`status`、`updatedAt`、`reportId`、`riskLevel`、`owner`、`summary`、`handoffSummary`。

- `frontend/src/features/admin/components/risk-reports-panel.tsx`
  - 对应旧版 `renderReports(reports)`。
  - 展示 `displayName`、`riskLevel`、`createdAt`、`summary`、`content`。
  - 点击报告后触发会话档案读取。

- `frontend/src/features/admin/components/conversation-archive-panel.tsx`
  - 对应旧版 `renderConversation(conversation)`。
  - 展示 `title || sessionId`、消息数量、消息 role、createdAt、content。
  - role 映射保持旧版逻辑：`USER -> 学生`，`ASSISTANT -> MindBridge`，`SYSTEM -> 系统`。

- `frontend/src/features/admin/components/knowledge-base-panel.tsx`
  - 对应旧版知识库维护区。
  - 支持 `.pdf`、`.md`、`.markdown`、`.txt`。
  - 支持上传入库、重建向量索引、备份向量索引。

修改页面位置：

- `frontend/src/app/admin/page.tsx`
  - 从 `WorkspacePlaceholder` 替换为 `AdminDashboard`。

### 5. 布局和导航

修改组件：

- `frontend/src/components/layout/sidebar-placeholder.tsx`
  - 管理员第一阶段可以保留单页 `/admin`，但应去掉“应用框架占位”字样。
  - 如果仍不拆子路由，禁用项可改为非 disabled 的锚点式 section key，或先保留但文案不要暗示未开发。

- `frontend/src/components/layout/global-header.tsx`
  - 接入全局状态组件。
  - 保持现有退出登录和侧边栏折叠逻辑。

### 6. 学生端小修复

不破坏现有 SSE 逻辑，仅补齐旧版体验：

- `frontend/src/features/chat/components/student-chat.tsx`
  - 快捷按钮从 `prompt.slice(0, 4)` 改为显式 label：
    - 压力失眠
    - 焦虑倾诉
    - 低落求助
    - 关系困扰
  - 可以补回旧版 CARE LOOP 说明，但不应影响聊天主流程。

## 推荐执行顺序

1. 新增 `features/system`，恢复 `/actuator/health` 与 `/api/agent/status` 展示。
2. 新增 `features/admin/types` 与 `features/admin/api`，先只做接口封装和类型。
3. 新增管理员 dashboard hooks，完成四类列表并行读取。
4. 实现 `/admin` 页面第一屏：指标 + cases + reports。
5. 接入报告点击后读取 conversation。
6. 实现 knowledge 状态、上传、重建、备份。
7. 清理管理员占位文案和侧边栏文案。
8. 小修学生端快捷按钮展示。
9. 联调验收：学生账号、管理员账号、无权限访问、刷新保持登录、401/403 处理、知识库上传操作。

## 验收清单

- `student/student123` 登录后进入 `/student`。
- `admin/admin123` 登录后进入 `/admin`。
- 学生账号访问 `/admin` 会进入 `/forbidden`。
- 管理员账号访问 `/student` 会进入 `/forbidden`。
- Header 能展示服务健康状态。
- Header 能展示模型状态。
- 管理员页面能看到报告数、高风险数、个案数、Excel 台账数、预警记录数。
- 管理员页面能看到 reports 和 cases 列表。
- 点击报告能加载对应会话档案。
- 知识库状态能读取。
- 知识库文件能上传，成功后刷新状态。
- 重建向量索引和备份向量索引可触发，成功后刷新状态。
- `npm run typecheck` 通过。
- `npm run lint` 通过。

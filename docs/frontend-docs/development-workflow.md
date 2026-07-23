# MindBridge Frontend Development Workflow

本文档定义 MindBridge 前端开发流程。后续开发必须按阶段推进，避免一次性生成全部业务页面。

## 本地运行约束

- Docker Compose 只运行 FastAPI、MySQL、Redis 和后端依赖，不管理 Next.js。
- 在项目根目录运行 `docker compose up -d` 启动后端。
- 在 `frontend/` 运行 `npm install` 和 `npm run dev` 启动宿主机前端。
- 前端地址为 `http://localhost:3000`，API 地址由 `NEXT_PUBLIC_API_BASE_URL` 统一配置，开发默认值为 `http://localhost:8000`。
- Axios、SSE、上传下载与健康检查都必须复用统一 API 配置，不得在业务组件中硬编码 Docker service name。
- `.next/` 与 `node_modules/` 只存在于宿主机且必须保持 Git 忽略；页面和样式修改由 Next.js HMR 生效。
- 不要执行 `docker compose down -v`，除非明确需要删除全部开发数据。

## 1. 总体策略

开发顺序：

```text
规范文档
-> 空工程初始化
-> 基础设施
-> 核心页面
-> 管理增强
-> 视觉和 QA
```

禁止一开始就开发所有业务页面。

## 2. 阶段 0：文档约束

已建立：

- `frontend/DESIGN.md`（前端视觉与交互的唯一事实来源）
- `docs/frontend-docs/architecture.md`
- `docs/frontend-docs/design-system.md`（兼容入口，指向 `frontend/DESIGN.md`）
- `docs/frontend-docs/coding-rules.md`
- `docs/frontend-docs/development-workflow.md`

后续任何前端开发都必须先阅读这些文档。

## 3. 阶段 1：初始化空工程

目标：只搭建工程，不开发业务页面。

范围：

- Next.js 15
- React 19
- TypeScript
- Ant Design
- Tailwind CSS
- Zustand
- React Query
- Axios
- ESLint
- 基础目录结构

不做：

- 登录页面。
- 聊天页面。
- 后台页面。
- 业务 API。
- Mock 大量数据。

验收：

- 项目能启动。
- TypeScript 检查通过。
- Lint 通过。
- 首页只显示最小工程状态。

## 4. 阶段 2：基础设施

目标：搭好所有页面都会依赖的底座。

开发顺序：

1. App Layout
2. Ant Design Provider
3. React Query Provider
4. Theme token
5. Axios client
6. API error model
7. Auth store
8. Route guard
9. Common status components

验收：

- Provider 结构清晰。
- API 封装只有一处。
- 权限判断只有一套。
- Ant Design 与 Tailwind 不冲突。

## 5. 阶段 3：登录与权限

目标：完成最小可用认证流。

页面：

- 登录页。
- 403 页。
- 会话过期处理。

功能：

- Basic Auth 登录兼容。
- 读取 `/api/profile`。
- 根据角色跳转。
- 学生进入学生端。
- 管理员进入管理端。
- 退出登录清理状态。

验收：

- stu0/000000 进入学生端。
- admin/000000 进入管理端。
- 管理员不能进入学生聊天。
- 学生不能进入管理后台。

## 6. 阶段 4：公共布局

目标：建立学生端和管理端布局。

学生端：

- 顶部状态栏。
- 聊天工作区容器。
- 快捷表达区域。

管理端：

- 侧边导航。
- 顶部状态栏。
- 内容容器。
- 面包屑或页面标题。

验收：

- 桌面端布局稳定。
- 移动端学生端可用。
- 管理端表格区域可承载后续页面。

## 7. 阶段 5：学生聊天

目标：优先完成 MindBridge 的核心体验。

功能：

- 发送消息。
- SSE 流式回复。
- token 增量展示。
- sessionId 维护。
- 新会话。
- 快捷表达。
- 错误事件展示。

接口：

- `POST /api/chat/stream`
- `GET /api/agent/status`
- `GET /actuator/health`

验收：

- 流式输出可见。
- 发送中不能重复提交。
- 后端 error event 可显示。
- 新会话可重置。
- 学生端不展示后台风险信息。

## 8. 阶段 6：管理首页

目标：完成管理员第一屏。

功能：

- 指标概览。
- 服务状态。
- 模型状态。
- 最近报告摘要。
- 最近个案摘要。

接口：

- `/api/admin/reports`
- `/api/admin/cases`
- `/api/admin/excel-records`
- `/api/admin/alerts`
- `/api/agent/status`
- `/actuator/health`

验收：

- 指标与后端数据一致。
- 高风险数量正确。
- 空数据状态正常。
- 接口失败可提示。

## 9. 阶段 7：风险报告

目标：完成管理端核心业务列表。

功能：

- 报告表格。
- 风险等级筛选。
- 报告详情 Drawer。
- 会话档案 Drawer。

接口：

- `/api/admin/reports`
- `/api/admin/conversations/{session_id}`

验收：

- 长文本不撑破表格。
- 点击报告能查看会话。
- 失败时显示错误。
- 风险标签统一。

## 10. 阶段 8：知识库

目标：完成 RAG 知识库维护。

功能：

- 知识库状态。
- 文件上传。
- 重建向量索引。
- 备份向量索引。

接口：

- `/api/admin/knowledge/status`
- `/api/admin/knowledge/file`
- `/api/admin/knowledge/rebuild-vector`
- `/api/admin/knowledge/backup`

验收：

- 上传状态清晰。
- 上传成功显示 chunks。
- 重建和备份有 loading。
- 失败原因可见。

## 11. 阶段 9：Agent Trace

目标：展示 Agent 工程能力。

功能：

- trace 列表。
- trace 详情。
- agent steps timeline。
- retrieved knowledge。
- assessment。
- response messages。

接口：

- `/api/admin/agent-traces`
- `/api/admin/tool-audits`

验收：

- 不直接大段裸 JSON。
- 能看清每轮 Agent 执行链路。
- 错误和空状态清晰。

## 12. 阶段 10：个案与工具队列

目标：完善管理闭环。

功能：

- 个案列表。
- 个案详情。
- 个案备注。
- 工具任务列表。
- 死信记录。
- 预警记录。

接口：

- `/api/admin/cases`
- `/api/admin/cases/{case_id}/notes`
- `/api/admin/tool-jobs`
- `/api/admin/dead-letters`
- `/api/admin/alerts`

验收：

- 风险个案状态清晰。
- 失败任务原因清晰。
- 管理员能快速判断处理优先级。

## 13. 每个页面交付流程

每个页面都按以下流程：

1. 阅读相关文档。
2. 确认页面目标。
3. 确认接口。
4. 设计数据结构。
5. 设计组件拆分。
6. 开发页面。
7. 自测登录态。
8. 自测 loading、empty、error。
9. 自测移动端关键布局。
10. 更新相关文档。

## 14. 每个页面验收清单

必须检查：

- 页面路径正确。
- 角色权限正确。
- 接口请求正确。
- loading 状态正确。
- 空数据状态正确。
- 错误状态正确。
- 表格或列表不溢出。
- 详情展示清晰。
- 退出登录后不可访问。
- 刷新页面后状态合理。

## 15. 开发节奏建议

推荐每轮只开发一个明确模块：

- 一轮只初始化工程。
- 一轮只做登录。
- 一轮只做学生聊天。
- 一轮只做管理首页。
- 一轮只做报告页。

不要在同一轮同时做多个业务模块，避免难以审查和回退。

# MindBridge Frontend Architecture

本文档是 MindBridge 前端工程的架构规范。后续开发 `frontend/` 时，以本文档为第一约束。

## 1. 架构目标

MindBridge 前端目标是构建一个企业级但不过度设计的 Next.js 管理平台，覆盖学生端心理陪伴、咨询师/管理员后台、知识库维护、风险报告、Agent 运行追踪等功能。

第一版目标是 MVP 可落地：

- 保留企业级工程边界。
- 避免复杂 Feature-Sliced Design 全量分层。
- 暂缓国际化、多主题、复杂权限矩阵等低优先级能力。
- 优先完成可演示、可维护、可扩展的 Agent 平台前端。

## 2. 技术栈

- Next.js 15
- React 19
- TypeScript
- Ant Design
- Tailwind CSS
- Zustand
- React Query
- Axios

## 3. 工程位置

新前端放在项目根目录：

```text
frontend/
```

现有后端继续保留在：

```text
app/
```

现有原生页面保留为迁移参考：

```text
app/static/
```

第一版不删除 `app/static`，避免影响当前可运行版本。

## 4. 推荐目录结构

第一版使用轻量企业结构：

```text
frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # 登录、无权限、会话失效
│   │   ├── (student)/       # 学生端
│   │   ├── (admin)/         # 管理后台
│   │   ├── providers/       # 全局 Provider
│   │   └── layout           # 根布局
│   ├── components/          # 跨模块通用组件
│   ├── features/            # 业务模块
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── cases/
│   │   ├── knowledge/
│   │   ├── alerts/
│   │   ├── tool-jobs/
│   │   └── agent-traces/
│   ├── hooks/               # 通用 hooks
│   ├── lib/                 # 基础设施：api、auth、theme、utils
│   ├── stores/              # Zustand stores
│   └── types/               # 全局类型与 DTO
├── public/
└── tests/
```

第一版不要主动创建 `entities/`、`widgets/`、`shared/ui/` 等复杂分层。只有当某类代码真实重复、真实增长后，再升级结构。

## 5. 页面模块划分

### 5.1 认证模块

- 登录页
- 角色识别
- 退出登录
- 403 无权限页
- 会话过期提示

当前后端使用 Basic Auth。前端第一版兼容 Basic Auth，但应把认证逻辑集中封装，方便后续迁移到 HttpOnly Cookie 或 token。

### 5.2 学生端

- 心理陪伴聊天
- SSE 流式回复
- 快捷表达
- 当前会话状态
- 服务状态
- 模型状态

学生端不展示风险评估、情绪评分、后台报告等敏感运营信息。

### 5.3 管理端首页

- 报告总数
- 高风险数量
- 个案数量
- Excel 台账数量
- 预警记录数量
- 系统服务状态
- 模型和 Agent 状态

### 5.4 风险报告

- 报告列表
- 风险等级筛选
- 学生与会话查询
- 报告详情
- 会话档案查看

### 5.5 风险个案

- 个案列表
- 个案详情
- 风险等级
- 负责人
- 状态
- 交接摘要
- 个案备注

### 5.6 知识库

- 知识库状态
- 文件上传
- 向量索引重建
- 向量索引备份
- 操作结果反馈

### 5.7 工具队列

- 工具任务列表
- 死信记录
- 任务状态
- 重试次数
- 错误原因

### 5.8 Agent 运行追踪

- Agent run trace
- retrieved knowledge
- assessment
- tool audit
- runtime status

该模块是 Agent 工程师简历项目的重点展示模块。

## 6. 组件层级

页面组织遵循：

```text
App Layout
-> Route Layout
-> Page
-> Feature Container
-> Business Component
-> Common Component
```

组件分类：

- `components/`: 跨业务复用，如 PageHeader、StatusTag、DataTable、EmptyState。
- `features/*/components/`: 只服务单个业务模块的组件。
- `features/*/hooks`: 单个业务模块的数据 hooks 和交互 hooks。
- `features/*/api`: 单个业务模块的 API 封装。
- `lib/*`: 不依赖具体业务的基础设施。

规则：

- 页面文件只做组装，不堆复杂逻辑。
- 业务逻辑优先下沉到 feature hooks。
- 通用组件必须至少被两个模块复用后再抽到 `components/`。
- 不为了“架构完整”创建空目录、空文件、空抽象。

## 7. Server Component 与 Client Component

必须严格区分 Server Component 和 Client Component。

Server Component 负责：

- 路由页面结构。
- 静态布局。
- 服务端可完成的数据预取。
- SEO 或首屏结构输出。

Client Component 负责：

- Ant Design 交互组件。
- 表单。
- 表格筛选。
- 点击事件。
- Zustand。
- React Query。
- SSE 流式聊天。

禁止为了省事把整个项目都变成 Client Component。只有需要浏览器交互的组件才声明为 Client Component。

## 8. 状态管理

### 8.1 React Query

React Query 管理服务端状态：

- profile
- agent status
- reports
- cases
- alerts
- excel records
- tool jobs
- dead letters
- knowledge status
- agent traces
- tool audits

要求：

- 每个 feature 维护自己的 query key。
- mutation 成功后精准失效相关 query。
- 退出登录时清理所有 query cache。
- 学生端聊天内容和心理内容不做长期持久化。

### 8.2 Zustand

Zustand 管理客户端状态：

- 当前登录摘要
- 当前角色
- 侧边栏折叠
- 当前主题模式
- 当前聊天 sessionId
- 当前聊天发送状态

禁止把服务端列表数据放入 Zustand。

### 8.3 组件局部状态

以下状态优先放组件内部或 URL query：

- 当前选中 tab
- 弹窗开关
- 当前选中行
- 表格筛选条件
- 搜索框输入

## 9. API 请求方案

### 9.1 普通 API

普通 HTTP API 使用 Axios 封装：

- baseURL
- Authorization
- timeout
- 401 处理
- 403 处理
- 统一错误转换
- 请求日志开关

当前主要接口：

- `GET /actuator/health`
- `GET /api/profile`
- `GET /api/agent/status`
- `GET /api/reports/me`
- `GET /api/admin/reports`
- `GET /api/admin/excel-records`
- `GET /api/admin/alerts`
- `GET /api/admin/cases`
- `GET /api/admin/cases/{case_id}/notes`
- `GET /api/admin/tool-jobs`
- `GET /api/admin/dead-letters`
- `GET /api/admin/agent-traces`
- `GET /api/admin/tool-audits`
- `GET /api/admin/conversations/{session_id}`
- `GET /api/admin/knowledge/status`
- `POST /api/admin/knowledge`
- `POST /api/admin/knowledge/file`
- `POST /api/admin/knowledge/rebuild-vector`
- `POST /api/admin/knowledge/backup`

### 9.2 SSE 聊天 API

`POST /api/chat/stream` 必须单独封装，不走 Axios。

原因：

- 该接口返回 `text/event-stream`。
- 需要逐 token 读取。
- 需要处理 ReadableStream。
- 需要支持中断和错误事件。

SSE 客户端职责：

- 发送 message 和 sessionId。
- 解析 meta、token、error 事件。
- 输出 token 增量。
- 返回最终 sessionId。
- 支持发送中状态。
- 支持异常中止。

## 10. 权限控制

第一版保留简单 RBAC：

- 学生：可进入学生端，可发送聊天。
- 管理员：可进入管理端，可查看后台数据，可管理知识库，不可发起学生聊天。

前端权限分三层：

- 路由级：学生路由、管理路由隔离。
- 菜单级：无权限菜单不可见。
- 操作级：上传、重建索引、查看审计等按钮按权限显示。

建议权限点：

- `chat:send`
- `reports:view`
- `cases:view`
- `knowledge:manage`
- `alerts:view`
- `tool-jobs:view`
- `agent-traces:view`
- `tool-audits:view`

安全边界必须以后端为准。前端权限只负责体验，不负责最终安全。

## 11. 表单方案

统一使用 Ant Design Form。

适用场景：

- 登录
- 报告筛选
- 个案备注
- 知识库上传
- 后续系统设置

规则：

- 简单校验写在表单规则。
- 复杂校验放在 feature 层。
- 提交统一走 React Query mutation。
- 表单提交失败使用统一错误展示。

聊天输入不使用复杂 Form，保持轻量交互。

## 12. 表格方案

统一使用 Ant Design Table。

后台列表页面必须具备：

- 加载状态
- 空状态
- 错误状态
- 分页预留
- 筛选预留
- 详情 Drawer 或 Modal
- 时间格式化
- 风险等级 Tag
- 状态 Tag

当前后端多为一次性数组返回。第一版可以前端分页，但文档中必须记录：后续数据增长后需要后端分页。

## 13. 国际化策略

第一版不做国际化。

原因：

- MindBridge 当前是中文高校心理咨询场景。
- 国际化会增加路由、文案、Provider 和测试复杂度。
- MVP 阶段收益不高。

约束：

- 页面文案使用中文。
- 业务字典集中维护，避免散落硬编码。
- 后续商业化或英文演示需要时，再引入 next-intl。

## 14. 主题策略

第一版只做单一亮色主题，并预留暗色扩展能力。

主题目标：

- 学生端：温和、克制、低压。
- 管理端：清晰、高密度、易扫描。
- 风险信息：分级明确，但避免学生端产生压迫感。

实现边界：

- Ant Design token 作为主题源头。
- Tailwind 主要做布局，不重写 AntD 样式。
- 不做复杂多主题切换。

## 15. Ant Design 与 Tailwind 使用边界

Ant Design 负责：

- Button
- Table
- Form
- Modal
- Drawer
- Upload
- Menu
- Tabs
- Tag
- Tooltip
- Alert
- Result
- Skeleton
- Spin

Tailwind 负责：

- flex
- grid
- spacing
- width
- height
- responsive layout
- page shell layout

禁止：

- 用 Tailwind 重写 AntD Button 颜色。
- 用 Tailwind 重写 AntD Table 内部结构。
- 同一个组件同时大量使用 AntD token 和 Tailwind 自定义颜色。
- 为了视觉效果破坏 AntD 默认交互一致性。

## 16. 第一版开发优先级

第一阶段：工程规范与脚手架。

第二阶段：基础设施。

- Layout
- Auth
- Route Guard
- Axios
- React Query
- Theme Provider
- Common Components

第三阶段：核心业务。

- 登录
- 学生聊天
- 管理首页
- 风险报告
- 知识库
- Agent Trace

第四阶段：增强后台。

- 个案闭环
- 工具队列
- 死信记录
- Tool Audit

第一版不要开发：

- 国际化
- 多主题系统
- 复杂 FSD
- 复杂低代码表格配置器
- 大量抽象组件库


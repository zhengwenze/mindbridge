# MindBridge Frontend Coding Rules

本文档是后续 Codex 开发 MindBridge 前端时必须遵守的编码规则。

## 1. 基本原则

- 不写过度抽象。
- 不创建无实际用途的空文件。
- 不为了架构好看拆出无复用价值的组件。
- 页面能清晰维护，比目录看起来复杂更重要。
- 每次开发只处理当前需求，不顺手重构无关模块。

## 2. 禁止事项

禁止：

- 使用 `any` 逃避类型设计。
- 重复创建 Axios 实例。
- 在多个文件散落认证头拼接逻辑。
- 把服务端列表数据放入 Zustand。
- 在页面文件堆超过 300 行复杂业务逻辑。
- 整个项目无差别声明 Client Component。
- 用 Tailwind 大量覆盖 Ant Design 内部样式。
- 在学生端展示后台风险评分或 Agent 评估链路。
- 在没有真实复用前抽象通用组件。
- 引入国际化框架。
- 引入多主题系统。
- 引入复杂低代码表格配置器。

## 3. 必须事项

必须：

- 使用 TypeScript 类型描述接口数据。
- 每个 API 响应类型有明确 DTO。
- 普通 API 走统一 Axios 封装。
- SSE 聊天走独立 fetch stream 封装。
- 服务端状态走 React Query。
- 客户端 UI 状态走 Zustand。
- 表单使用 Ant Design Form。
- 表格使用 Ant Design Table。
- 风险等级使用统一字典和 Tag。
- 时间格式化集中处理。
- 退出登录时清理认证状态和 React Query 缓存。
- 管理端路由做角色校验。
- 学生端路由做角色校验。

## 4. 文件组织规则

每个 feature 可以包含：

```text
features/{name}/
├── api
├── hooks
├── components
├── types
└── constants
```

不是每个 feature 都必须创建这些目录。只在需要时创建。

页面文件规则：

- 负责组合布局。
- 不直接写复杂请求逻辑。
- 不直接写复杂数据转换。
- 不直接写大型 JSX 结构。

组件文件规则：

- 单个组件职责清晰。
- 超过 200 行需要考虑拆分。
- 只服务一个 feature 的组件放在 feature 内。
- 两个以上 feature 复用后，才移动到 `components/`。

## 5. API 规则

普通接口：

- 统一 baseURL。
- 统一错误处理。
- 统一认证处理。
- 统一超时。
- 统一返回数据转换。

SSE 接口：

- 独立封装。
- 支持 token 增量回调。
- 支持 meta 事件。
- 支持 error 事件。
- 支持发送中状态。
- 支持中止。

上传接口：

- 独立处理 multipart。
- 必须显示上传进度或上传中状态。
- 必须展示后端返回的失败原因。

## 6. React Query 规则

必须为每个 feature 定义稳定 query key。

示例分类：

- profile
- agentStatus
- reports
- cases
- knowledgeStatus
- alerts
- toolJobs
- deadLetters
- agentTraces
- toolAudits

mutation 成功后只刷新相关 query，不全局无脑刷新。

列表页规则：

- loading 状态必须可见。
- error 状态必须可见。
- empty 状态必须可见。
- refetch 操作必须有明确入口或自动策略。

## 7. Zustand 规则

Zustand 只保存客户端状态：

- sidebarCollapsed。
- themeMode。
- auth snapshot。
- currentRole。
- activeChatSessionId。
- chatStreamingState。

禁止保存：

- reports 列表。
- cases 列表。
- knowledge status。
- alerts 列表。
- tool jobs。
- agent traces。

这些全部属于服务端状态。

## 8. 权限规则

权限判断统一封装。

禁止：

- 在页面里反复手写角色字符串判断。
- 只隐藏菜单但不保护路由。
- 学生端请求管理员接口。
- 管理员账号进入学生聊天。

权限控制层级：

- route guard。
- menu visibility。
- action visibility。
- API 403 fallback。

## 9. 表单规则

Ant Design Form 统一管理表单。

要求：

- 每个表单有 loading 状态。
- 提交时禁用按钮。
- 提交失败展示明确错误。
- 提交成功给出反馈。
- 表单字段命名与后端 DTO 尽量一致。

聊天输入例外：聊天输入保持轻量，不使用复杂 Form。

## 10. 表格规则

表格页面统一包含：

- 页面标题。
- 筛选区。
- 表格。
- 详情 Drawer。

每个表格必须处理：

- loading。
- empty。
- error。
- long text。
- time format。
- status tag。

操作列规则：

- 主操作最多一个。
- 次操作可放入更多菜单。
- 危险操作必须确认。

## 11. 样式规则

Ant Design 负责控件。

Tailwind 负责布局。

允许 Tailwind：

- flex。
- grid。
- gap。
- margin。
- padding。
- width。
- height。
- responsive。

不允许 Tailwind：

- 重写 AntD Button 主色。
- 重写 AntD Table 单元格结构。
- 重写 AntD Modal 内部结构。
- 与 AntD token 定义冲突颜色。

## 12. 学生端安全规则

学生端禁止出现：

- 风险等级标签。
- 情绪评分。
- 置信度。
- 后台报告详情。
- 管理后台入口。
- Agent trace。
- Tool audit。

学生端文案要避免：

- 诊断式口吻。
- 恐吓式提示。
- 过度承诺。
- 替代专业咨询的表述。

## 13. 管理端规则

管理端必须突出：

- 风险等级。
- 更新时间。
- 状态。
- 负责人。
- 失败原因。
- 可追踪链路。

报告、个案、工具队列、审计日志都必须能打开详情。

大段内容不要直接铺在列表里。

## 14. 测试与验证规则

每个页面开发完成后必须验证：

- 页面能打开。
- 登录态正确。
- 无权限跳转正确。
- loading 可见。
- 空数据可见。
- 接口错误可见。
- 表单提交状态正确。
- 移动端不明显溢出。

涉及聊天时必须验证：

- SSE token 增量展示。
- 发送中按钮禁用。
- error event 可展示。
- 新会话可重置。

## 15. 文档同步规则

开发中如发生以下变化，必须同步文档：

- 新增页面。
- 新增 feature。
- 新增 API 封装模式。
- 新增权限点。
- 修改设计系统。
- 调整开发流程。


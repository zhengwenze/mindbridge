# MindBridge 文档地图

本目录按“现役规范、实施设计、计划与验收、历史方案”组织。代码与运行配置是行为事实来源；文档描述与代码冲突时，应先验证代码和运行态，再就地更新现役文档。

## 现役入口

- [项目总览与运行说明](../README.md)：功能、配置、启动、测试和调用示例。
- [前端架构](frontend-docs/architecture.md)：Next.js 工程边界和模块组织。
- [前端编码规则](frontend-docs/coding-rules.md)：前端实现约束。
- [前端开发流程](frontend-docs/development-workflow.md)：本地运行和交付门禁。
- [前端设计系统](../frontend/DESIGN.md)：视觉、交互和心理安全的唯一事实来源。
- [多知识库管理](knowledge-docs/knowledge-base.md)：数据边界、迁移、接口与运行验证。
- [文档管理第一阶段](knowledge-docs/document-management-phase-1.md)：解析、拆分、索引、补偿和测试契约。

## 计划与验收

- [Sprint / Epic / Story 拆分](sprint-epic-story/sprint-epic-story.md)：需求与候选工作，不等同于全部已交付。
- [简历核心功能数据测试方案](test-plan/resume-core-metrics-test-plan.md)：指标口径和待补评测能力；未产出报告前不得把占位符当结果。

## 已实施的历史方案

以下文档保留决策背景，不再作为当前待办清单：

- [管理员核心功能迁移清单](frontend-docs/admin-core-migration-checklist.md)
- [学生端历史会话开发方案](frontend-docs/历史会话开发方案.md)
- [多知识库开发方案](knowledge-docs/多知识库开发方案.md)
- [文档上传功能开发计划](dev-docs/文档上传功能开发计划.md)

兼容入口 [frontend-docs/design-system.md](frontend-docs/design-system.md) 只负责指向 `frontend/DESIGN.md`，不要在两处复制设计规则。

## 目录约定

- `frontend-docs/`：前端架构、编码与历史迁移方案。
- `knowledge-docs/`：知识库和文档生命周期。
- `sprint-epic-story/`：需求拆分与候选范围。
- `test-plan/`：可复现测试与指标口径。
- `dev-docs/`：遗留的文档上传历史计划目录；是否迁入 `knowledge-docs/` 需在确认引用影响后单独处理。

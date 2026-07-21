# MindBridge 项目协作指南

## 项目定位

MindBridge 是面向高校心理健康场景的全栈智能体应用：FastAPI 后端负责认证、对话、风险处置、知识库和工具任务，Next.js 前端提供学生与管理员工作区。

## 启动与验证

- 后端与依赖：`docker compose up -d --build`
- 前端开发：`./scripts/dev-frontend.sh`
- 健康检查：`curl http://localhost:8000/actuator/health`
- 后端测试：`docker compose exec -T app env MINDBRIDGE_BASE_URL=http://127.0.0.1:8000 python -m unittest discover -s tests`
- 前端门禁：在 `frontend/` 运行 `npm run typecheck && npm run lint && npm run test:ui-boundaries && npm run build`

## 技术栈与目录

- `app/`：FastAPI、SQLAlchemy、Agent runtime、RAG 与业务服务。
- `frontend/`：Next.js 15、React 19、Ant Design、React Query、Zustand；修改前继续遵守该目录的 `AGENTS.md` 和 `DESIGN.md`。
- `migrations/`：Alembic 迁移；`tests/`：基于真实 Docker 服务的后端测试。
- `skills/`：MindBridge 运行时加载的心理支持 Skills。
- `docs/`：现役规范、实施设计与历史计划，入口见 `docs/README.md`。
- `data/`、`target/`、`.next/`、`out/`：运行数据或生成物，不是源码目录。

## 约定与安全边界

- 不使用 SQLite、内存数据库或 FastAPI TestClient 替代项目规定的 MySQL 集成链路。
- 学生端不得展示风险评分、心理报告、Agent 推理或后台处置细节。
- 不提交 `.env`、模型权重、数据库、向量库、上传原件、缓存或构建产物。
- 不执行 `docker compose down -v`，除非用户明确授权删除开发数据。
- 代码、配置与文档冲突时先以当前代码和可复现运行结果裁决，再更新权威文档。

## 当前状态

项目同时支持事件驱动多智能体、LangGraph 和 custom fallback；实际选择由 `AGENT_FRAMEWORK` 决定。Docker 与 `.env.example` 默认选择 `langgraph`，未提供环境变量时 Python 配置默认选择 `event_driven_multi_agent`。

# MindBridge

## 核心能力

- 学生端 SSE 流式聊天，前端可展示打字机式输出。
- Basic Auth 登录，支持学生和管理员角色隔离。
- LangGraph 多 Agent 工作流：Memory、Supervisor、Knowledge、RiskGuardian、Companion、Counselor，未安装 LangGraph 时自动回退到自研有限循环 runtime。
- 动态路由 RAG：先判断 `CHAT / CONSULT / RISK`，普通问题不查知识库，咨询和风险场景才进入检索增强。
- Chroma 向量 RAG 知识库：支持 Markdown、txt、PDF 文件上传，自动切块，使用 `text-embedding-3-small` 写入向量库，并与 BM25 关键词召回融合后进入本地 reranker；向量不可用时保留本地 BM25 + 词面检索兜底。
- 心理风险评估：高风险词典优先、LLM JSON 评估、关键词兜底。
- 后台报告：记录情绪标签、情绪分数、风险等级、置信度和摘要，但学生端不展示后台评估结果。
- 数据闭环：咨询/风险消息完整写入 MySQL，短期上下文写入 Redis，高风险消息写入 Excel 台账并通过邮件发送预警。
- 本地微调模型接入：支持通过 Ollama 加载 `mindbridge-qwen2.5-7b-ft-q4_k_m.gguf`。
- 本地模型接入（没微调）：通过 Ollama 加载 qwen2.5:7b 模型。
- OpenAI-compatible API 接入：支持云端模型。
- MCP 工具服务：暴露 Excel 报告写入和风险通知工具，后端高风险后处理通过 MCP client 调用这些工具。
- RAG 评测：Recall@K、Precision@K、MRR、NDCG@K、HitRate。

## 技术栈

```text
语言：Python
Web 框架：FastAPI
服务运行：Uvicorn / ASGI
数据库：MySQL，SQLAlchemy ORM，PyMySQL 驱动
短期记忆：Redis
配置管理：pydantic-settings，.env
AI 接入：Ollama，本地微调 GGUF 模型，OpenAI-compatible API，Mock Provider
Agent 编排：LangGraph bounded agent loop，自研 runtime 兜底
RAG：本地知识库切块、OpenAI Embeddings、Chroma 向量库、BM25、分数融合、本地 reranker、上下文扩展
流式输出：Server-Sent Events
文档解析：pypdf
Excel 台账：openpyxl
邮件预警：SMTP / smtplib
前端：Next.js / React / Ant Design，仅在 Mac 宿主机运行开发服务器并使用 HMR
认证：Basic Auth
工具协议：MCP
```

说明：本项目提供 LangGraph runtime，入口在 `app/agents/langgraph_runtime.py`；同时保留 `app/agents/runtime.py` 作为无框架兜底。RAG 默认使用 Chroma 本地持久化向量库做语义召回，同时用 BM25 做关键词召回，再融合并本地 rerank；未安装 Chroma、未配置 `OPENAI_API_KEY` 或向量服务异常时，会自动回退到本地 BM25 + `hybrid_score` reranker，避免演示环境中断。

## 目录结构

```text
app/
├── agents/          # LangGraph 多 Agent 编排和自研 runtime 兜底
├── api/             # FastAPI 路由
├── core/            # 配置、数据库、安全、启动初始化
├── knowledge/       # 内置校园心理知识库
├── mcp_tools/       # MCP 工具服务
├── models/          # SQLAlchemy 实体
├── rag_eval/        # RAG 评测脚本和数据集
├── schemas/         # Pydantic DTO
├── services/        # AI、聊天、知识库、评估、报告、工具服务
└── static/          # 原生前端页面

models/mindbridge-qwen2.5-7b-ft/
├── Modelfile        # Ollama 模型定义
└── README.md        # GGUF 模型放置说明

scripts/
├── dev-backend.sh
├── dev-frontend.sh
├── run-dev.sh
├── start-ollama.sh
├── create-finetuned-model.sh
└── package-release.sh
```

## Agent loop

每轮对话进入一个 LangGraph bounded agent loop，由 controller 根据共享状态自主选择下一个 Agent，最多执行 8 个 Agent 步，防止心理安全场景出现无限自主循环：

```text
controller
-> MemoryAgent / SupervisorAgent / KnowledgeAgent / RiskGuardianAgent / CompanionAgent / CounselorAgent
-> controller
-> END 或 max_steps=8
-> SSE 流式输出
```

各 Agent 分工：

- `MemoryAgent`：优先从 Redis 读取本会话短期记忆；Redis 为空时从 MySQL 最近消息回填，并生成本轮记忆摘要。
- `SupervisorAgent`：判断 `CHAT / CONSULT / RISK`，决定是否进入心理支持链路。
- `KnowledgeAgent`：将学生输入改写为知识库查询词，执行 RAG 检索。
- `RiskGuardianAgent`：执行后台心理状态评估，同时保留高风险词库硬兜底。
- `CompanionAgent`：处理普通学习、编程、校园事务和闲聊。
- `CounselorAgent`：结合记忆、RAG 和风险评估，生成心理支持回复 prompt。

## 安装依赖

```bash
pip install -r requirements.txt
```

`requirements.txt` 已包含：

```text
langchain-core
langgraph
chromadb
pymysql
redis
```

如果交付环境暂时无法安装 LangGraph，系统仍会自动回退到自研 runtime，不影响 Mock 演示和基本功能。

## MySQL 和 Redis 配置

系统默认使用 MySQL 保存完整业务数据和完整聊天消息，使用 Redis 保存短期对话记忆。使用 Docker Compose 时不需要手动创建数据库，`mysql` 容器会自动初始化 `mindbridge` 数据库和账号。非 Docker 方式启动时，先创建数据库：

```sql
CREATE DATABASE mindbridge DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mindbridge'@'%' IDENTIFIED BY 'mindbridge';
GRANT ALL PRIVILEGES ON mindbridge.* TO 'mindbridge'@'%';
FLUSH PRIVILEGES;
```

`.env` 中配置连接：

```env
DATABASE_URL=mysql+pymysql://mindbridge:mindbridge@127.0.0.1:3306/mindbridge?charset=utf8mb4
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_MEMORY_TTL_SECONDS=86400
REDIS_MEMORY_MAX_MESSAGES=40
```

完整聊天记录写入 MySQL 的 `chat_sessions`、`chat_messages` 等表。Redis 只保存每个会话最近 `REDIS_MEMORY_MAX_MESSAGES` 条短期上下文，并通过 `REDIS_MEMORY_TTL_SECONDS` 自动过期。

## 本地开发

### 前置条件

1. **安装 Docker 和 Docker Compose**
   - macOS：使用 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Linux：使用系统包管理器安装 `docker` 和 `docker-compose-plugin`

2. **安装 Ollama 并下载模型**

   从 [Ollama 官网](https://ollama.com/) 安装 Ollama，然后下载所需模型：

   ```bash
   ollama pull qwen2.5:7b
   ollama pull qwen3-embedding:0.6b
   ```

3. **启动本地 Ollama 服务**

   ```bash
   ollama serve
   ```

   > **注意**：Linux 用户需要确保 Ollama 监听外部地址：
   >
   > ```bash
   > export OLLAMA_HOST=0.0.0.0:11434
   > ollama serve
   > ```

Docker Compose 只管理 FastAPI、MySQL、Redis 及后端依赖，不再构建或运行 Next.js 开发服务。前端必须在 Mac 宿主机通过 npm 启动。

终端一，启动 Docker 后端与依赖：

```bash
cd mindbridge
docker compose up -d
```

后端镜像或 Python 依赖变化后，可先执行 `docker compose build app` 再重新运行上面的启动命令。也可以使用等价脚本，它会同时输出后端服务状态：

```bash
./scripts/dev-backend.sh
```

终端二，启动宿主机前端：

```bash
cd frontend
npm install
npm run dev
```

也可以使用等价脚本；仅当 `node_modules` 不存在时，它才会执行 `npm install`：

```bash
./scripts/dev-frontend.sh
```

Docker 服务：

| 服务    | 镜像           | 宿主机端口 | 说明 |
| ------- | -------------- | ---------- | ---- |
| `mysql` | MySQL 8.0      | `13306`    | 数据库，使用 `mysql-data` 持久化 |
| `redis` | Redis 7.2      | `16379`    | 短期记忆缓存，使用 `redis-data` 持久化 |
| `app`   | MindBridge API | `8000`     | FastAPI、Agent、Chroma 与业务链路 |

Chroma 当前以内嵌持久化客户端运行在 `app` 服务中，数据保存到宿主机 `data/chroma/`，没有独立 Compose service。

> **Ollama**：不启动 Ollama 容器，直接复用电脑本机的 Ollama 服务，容器通过 `http://host.docker.internal:11434` 访问。

### 验证启动

等待约 30 秒后，检查服务状态：

```bash
# 查看容器状态
docker compose ps

# 查看后端日志
docker compose logs -f app

# 健康检查
curl http://localhost:8000/actuator/health
```

### 访问应用

- 前端：http://localhost:3000
- 后端：http://localhost:8000
- FastAPI 文档：http://localhost:8000/docs

浏览器通过 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` 直接访问后端，不使用 Docker 内部服务名。修改 `frontend/` 下的页面、组件或样式后，宿主机 Next.js HMR 会自动生效，不需要重启任何 Docker 服务。前端开发构建缓存只存在于宿主机 `frontend/.next/`。

**默认账号：**

| 角色   | 用户名    | 密码         |
| ------ | --------- | ------------ |
| 学生   | `student` | `student123` |
| 管理员 | `admin`   | `admin123`   |

### 停止服务

```bash
docker compose down
```

如需清除数据：

不要执行 `docker compose down -v`，除非明确准备删除 MySQL、Redis 等全部开发数据卷。日常停止只使用 `docker compose down`。

### 数据持久化

- **MySQL**：数据存储在 Docker volume `mysql-data` 中
- **Redis**：数据存储在 Docker volume `redis-data` 中
- **Chroma 向量库**：存储在项目目录 `data/chroma/` 下
- **Excel 台账**：存储在项目目录 `data/mindbridge-risk-ledger.xlsx`
- **Ollama 模型**：使用电脑本机的 Ollama 模型目录，不会重复下载

### 环境变量配置

在 `.env` 文件中可以自定义配置：

```env
# AI 配置（默认使用本机 Ollama）
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b
OLLAMA_AUTO_PULL=false

# Mock 模式（仅验证服务链路，不需要真实模型）
# AI_PROVIDER=mock
```

### 常见问题

**Q: 容器启动后无法连接 Ollama？**

A: 确保：

1. 本机 Ollama 服务已启动：`ollama serve`
2. Linux 用户设置了 `OLLAMA_HOST=0.0.0.0:11434`
3. Mac/Windows 用户 Docker Desktop 已开启 "Allow the default Docker socket to be used"

**Q: 首次启动构建时间很长？**

A: Docker 需要下载 Node.js 和 Python 基础镜像，以及安装依赖包，首次构建可能需要 5-10 分钟。

**Q: 如何使用 OpenAI 模型？**

A: 在 `.env` 中配置：

```env
AI_PROVIDER=openai
OPENAI_API_KEY=你的_API_Key
OPENAI_MODEL=gpt-4o-mini
```

## Chroma 向量库与快照

应用启动时会同步 `app/knowledge/*.md` 内置默认知识库到数据库。当前默认文档覆盖校园心理支持总则、风险等级策略、焦虑恐慌、情绪低落、睡眠作息、学业压力、考试季、人际关系、新生适应、咨询转介和隐私边界等主题；如果默认 md 内容发生变化，重启后对应来源会按当前切块规则刷新入库。

知识库默认优先使用 Chroma 持久化向量库，embedding 由 OpenAI `text-embedding-3-small` 提供。查询时会同时取向量候选和 BM25 候选，按配置权重融合后进入本地 reranker。没有 `OPENAI_API_KEY`、缺少 `chromadb` 或向量调用失败时，会回退到本地 BM25 + `hybrid_score` reranker：

```env
OPENAI_API_KEY=你的_API_Key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
KNOWLEDGE_VECTOR_ENABLED=true
KNOWLEDGE_VECTOR_REQUIRED=false
KNOWLEDGE_CANDIDATE_K=16
KNOWLEDGE_HYBRID_VECTOR_WEIGHT=0.65
KNOWLEDGE_HYBRID_BM25_WEIGHT=0.35
KNOWLEDGE_RERANK_ENABLED=true
CHROMA_PERSIST_DIR=data/chroma
CHROMA_SNAPSHOT_DIR=data/chroma-snapshots
```

管理员接口：

```bash
curl -u admin:admin123 http://127.0.0.1:8000/api/admin/knowledge/status
curl -u admin:admin123 -X POST http://127.0.0.1:8000/api/admin/knowledge/rebuild-vector
curl -u admin:admin123 -X POST http://127.0.0.1:8000/api/admin/knowledge/backup
```

当 `KNOWLEDGE_VECTOR_REQUIRED=false` 时，如果 Chroma 或 embedding 服务不可用，系统会降级到本地 BM25 + 词面 rerank；设为 `true` 则启动或检索失败时直接暴露错误。

## 工具队列、限流与死信

心理报告生成后，工具链不会阻塞学生端流式回复，而是写入 `tool_jobs` 队列表：

```text
EXCEL_REPORT
CASE_CREATE -> ALERT_SEND
```

Excel 写入使用进程内锁串行化，个案创建保持幂等；预警发送使用独立线程池并支持每分钟限流。失败任务会按延迟重试，超过 `TOOL_QUEUE_MAX_ATTEMPTS` 后进入 `dead_letter_records`。

```env
TOOL_QUEUE_ENABLED=true
TOOL_QUEUE_EXCEL_WORKERS=1
TOOL_QUEUE_EMAIL_WORKERS=2
ALERT_EMAIL_RATE_LIMIT_PER_MINUTE=30
ALERT_EMAIL_DELIVERY_MODE=log
```

`ALERT_EMAIL_DELIVERY_MODE=log` 适合本地演示；生产发邮件时改为 `smtp` 并配置 SMTP。

## 邮件预警配置

高风险消息会触发心理报告，并由后端通过 MCP 工具调用完成 Excel 台账写入和邮件预警。发送邮件前需要在 `.env` 中配置 SMTP：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-account@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_USE_TLS=true
SMTP_USE_SSL=false
ALERT_EMAIL_FROM=your-account@example.com
ALERT_EMAIL_TO=counselor@example.com,admin@example.com
ALERT_EMAIL_SUBJECT_PREFIX=[MindBridge 高风险预警]
```

未配置 SMTP 或收件人时，系统不会中断聊天流程，但会在 `alert_records` 中写入 `FAILED` 记录，提示缺少的配置项。

## 接入本地微调 GGUF 模型

Python 版默认预留本地模型名：

```text
mindbridge-qwen2.5-7b-ft:latest
```

模型目录：

```text
models/mindbridge-qwen2.5-7b-ft/
```

需要放入的 GGUF 权重：

```text
models/mindbridge-qwen2.5-7b-ft/mindbridge-qwen2.5-7b-ft-q4_k_m.gguf
```

如果本机已经有其他位置的 GGUF 模型文件，可以通过 `UPSTREAM_GGUF` 指定路径并建立软链接：

```bash
UPSTREAM_GGUF=/path/to/mindbridge-qwen2.5-7b-ft-q4_k_m.gguf ./scripts/create-finetuned-model.sh
```

创建 Ollama 模型：

```bash
./scripts/create-finetuned-model.sh
```

启动 Ollama：

```bash
./scripts/start-ollama.sh
```

启动 Python 服务：

```bash
AI_PROVIDER=ollama ./scripts/run-dev.sh
```

查看模型接入状态：

```bash
curl -u student:student123 http://127.0.0.1:8000/api/agent/status
```

返回结果中的 `finetunedModel.ggufExists` 和 `finetunedModel.modelfileExists` 会显示模型资产是否就绪。
同时 `agentFramework.active` 会显示当前实际使用的 Agent 编排框架：

```text
langgraph
custom
```

## 接入 OpenAI-compatible API

```bash
AI_PROVIDER=openai \
OPENAI_API_KEY=你的_API_Key \
OPENAI_MODEL=gpt-4o-mini \
OPENAI_EMBEDDING_MODEL=text-embedding-3-small \
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

知识库向量检索也使用同一个 `OPENAI_API_KEY` 调用 embeddings API。相关配置：

```env
KNOWLEDGE_VECTOR_ENABLED=true
KNOWLEDGE_VECTOR_REQUIRED=false
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
KNOWLEDGE_CANDIDATE_K=16
KNOWLEDGE_HYBRID_VECTOR_WEIGHT=0.65
KNOWLEDGE_HYBRID_BM25_WEIGHT=0.35
KNOWLEDGE_RERANK_ENABLED=true
CHROMA_PERSIST_DIR=data/chroma
CHROMA_COLLECTION_NAME=mindbridge_knowledge
```

当 `KNOWLEDGE_VECTOR_REQUIRED=false` 时，缺少 API key 或 Chroma 不可用不会阻断聊天，系统会回退到本地 BM25 + `hybrid_score` reranker。若交付验收要求必须走 Chroma 向量检索，可设置 `KNOWLEDGE_VECTOR_REQUIRED=true`。

## 调用示例

学生流式聊天：

```bash
curl -N -u student:student123 \
  -H 'Content-Type: application/json' \
  -d '{"message":"我最近很焦虑，晚上总是睡不着"}' \
  http://127.0.0.1:8000/api/chat/stream
```

高风险示例，会触发心理报告、风险个案创建和预警工具计划；Excel 保留为台账输出，邮件/log 是预警通道之一：

```bash
curl -N -u student:student123 \
  -H 'Content-Type: application/json' \
  -d '{"message":"我不想活了，感觉撑不下去了"}' \
  http://127.0.0.1:8000/api/chat/stream
```

管理员查看报告：

```bash
curl -u admin:admin123 http://127.0.0.1:8000/api/admin/reports
```

管理员追加知识库：

```bash
curl -u admin:admin123 \
  -H 'Content-Type: application/json' \
  -d '{"source":"sleep-guide","content":"失眠时可先固定起床时间，减少睡前屏幕刺激，必要时联系校心理中心。"}' \
  http://127.0.0.1:8000/api/admin/knowledge
```

追加知识库时，系统会同步写入 MySQL 分块和 Chroma 向量库；已有分块会在首次向量检索时自动补建 Chroma 索引。

## RAG 评测

```bash
AI_PROVIDER=mock python -m app.rag_eval.runner
```

评测报告输出到：

```text
target/rag-eval-report.json
```

## Docker 集成测试

测试必须基于 Docker Compose 启动后的真实服务运行，不使用 SQLite、内存数据库或 FastAPI TestClient。先按上文一键启动：

```bash
docker compose up -d --build
curl http://localhost:8000/actuator/health
```

健康检查返回 `{"status":"UP"}` 后执行：

```bash
docker compose exec app env MINDBRIDGE_BASE_URL=http://127.0.0.1:8000 \
  python -m unittest discover -s tests
```

## Agent Runtime Harness

线上对话通过 `MindBridgeAgentHarness` 组织一次 Agent run。Harness 不改变 LangGraph / custom runtime 内部的多 Agent 协作顺序，而是在外层统一管理：

- 输入脱敏和 session 解析。
- Memory / Supervisor / Knowledge / RiskGuardian / Response Agent 调用。
- 心理报告落库和工具计划生成。
- 学生与助手消息持久化。
- Agent steps、知识召回、风险结果等 trace 数据输出。

因此 HTTP 层只负责认证和 SSE 流式输出，Agent 后处理逻辑集中在 runtime harness 内。

## Engineering Harness

项目提供工程 harness，用 mock AI、真实 MySQL、真实 Redis 和本地输出验证核心链路。Harness 会重置数据库结构，必须使用一次性的 Docker MySQL 测试库，不要指向正在演示或承载数据的主库：

- Risk Safety Harness：高风险识别、报告生成、后台元数据不外显、工具队列入队。
- Agent Routing Harness：通过 `MindBridgeAgentHarness` 验证 CHAT / CONSULT / RISK 路由和多 Agent 步骤。
- Standard Skills Harness：验证 `skills/*/SKILL.md` 标准 Skill 加载、选择逻辑和交接摘要模板渲染。
- RAG Harness：基于内置评测集验证 Recall@K、MRR、NDCG 和 HitRate。
- API Harness：健康检查、认证授权、SSE 聊天、管理员知识库接口。
- Tool Queue Harness：Excel / case / alert 依赖、幂等、限流和 dead letter。

```bash
docker compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS mindbridge_harness DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON mindbridge_harness.* TO 'mindbridge'@'%'; FLUSH PRIVILEGES;"

docker compose exec app env \
  MINDBRIDGE_BASE_URL=http://127.0.0.1:8000 \
  MINDBRIDGE_HARNESS_DATABASE_URL='mysql+pymysql://mindbridge:mindbridge@mysql:3306/mindbridge_harness?charset=utf8mb4' \
  python -m app.harness.runner
```

报告输出到：

```text
target/harness/harness-report.json
target/harness/rag-eval-report.json
```

## MCP 工具服务

MCP Python 包建议使用 Python 3.10 或 3.11 安装运行。

```bash
python -m app.mcp_tools.server
```

业务后端触发报告后处理时，默认通过异步工具队列复用同一套工具实现；关闭队列后会作为 MCP client 通过 stdio 启动同一个 MCP server。

暴露工具：

- `mindbridge_excel_report`
- `mindbridge_case_create`
- `mindbridge_alert_send`
- `mindbridge_alert_ack`
- `mindbridge_case_note_add`
- `mindbridge_alert_notify`

内置标准 Skills 位于 `skills/*/SKILL.md`，运行时由 `MindBridgeSkillRegistry` 加载：

- `supportive_response_baseline`：心理咨询与风险回复的基础共情、边界和学生端表达规则。
- `high_risk_safety_plan`：高风险时引导模型优先完成短期安全计划。
- `anxiety_grounding_support`：焦虑、惊恐、崩溃场景的稳定化和 grounding 指引。
- `sleep_routine_support`：失眠、睡眠节律紊乱场景的安全睡眠建议。
- `academic_stress_planning`：考试、作业、论文、绩点压力的下一步拆解。
- `referral_resource_guidance`：校内心理中心、辅导员、可信任支持人和紧急资源转介。
- `counselor_handoff_summary`：生成给辅导员/管理员看的个案交接摘要模板。

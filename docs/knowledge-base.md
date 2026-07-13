# 多知识库管理

MindBridge 使用 MySQL 保存知识库、文档和片段，并让每个知识库拥有独立 Chroma collection。

```text
knowledge_bases 1 ── N knowledge_documents 1 ── N knowledge_chunks
                         \                         \
                          collection: mindbridge_kb_<knowledge_base_id>
```

Collection 名称由不可变的数据库 ID 生成，而不是知识库名称。管理员修改显示名称时，已经写入的向量不需要搬迁，也不会误操作名称相近的 collection。

## 全局 Embedding

所有知识库使用同一个 Ollama 模型：

```env
EMBEDDING_MODEL=qwen3-embedding:0.6b
```

该值映射到 `settings.embedding_model`。创建和编辑接口不会接受模型或 collection 名称；服务端只会从 MySQL 读取可信的 collection 名称。

## 默认知识库与旧数据迁移

启动 seed 会幂等创建：心理健康基础知识库、校园心理咨询政策库、危机干预知识库。内置 Markdown 和所有历史 `knowledge_chunks` 都归属基础库；不会自动按内容猜测分类。

新数据库：

```bash
alembic upgrade head
```

已有、尚未使用 Alembic 的部署必须先停止应用并备份 MySQL，然后执行。

### Python 模块搜索路径说明

直接运行迁移脚本时，Python 默认只将 `scripts/` 目录加入 `sys.path`，不会自动把项目根目录加入，导致根目录下的 `app/` 无法被识别，报：

```text
ModuleNotFoundError: No module named 'app'
```

使用绝对路径执行不会改变该行为。脚本已修复：启动时自动将项目根目录加入 `sys.path`，不再出现上述错误。

### 推荐：使用 Docker 执行迁移

宿主机 Conda `(base)` 环境可能缺少 MySQL 驱动（`ModuleNotFoundError: No module named 'pymysql'`）。推荐用 Docker 执行迁移，依赖和 MySQL 网络配置都与项目一致：

```bash
docker compose stop app
docker compose run --rm --no-deps --entrypoint python app \
  scripts/migrate_legacy_knowledge.py --adopt-legacy
docker compose up -d app
```

### 可选：在宿主机执行

如果必须在宿主机执行，先安装依赖，并配置宿主机可访问的 MySQL 地址（Compose 默认是 `127.0.0.1:13306`）：

```bash
python -m pip install -r requirements.txt
DATABASE_URL='mysql+pymysql://mindbridge:mindbridge@127.0.0.1:13306/mindbridge?charset=utf8mb4' \
  python scripts/migrate_legacy_knowledge.py --adopt-legacy
```

命令会导出旧片段到 `data/legacy-knowledge-backups/<timestamp>/knowledge_chunks.json`，复制原 Chroma 持久化目录，并将旧片段映射为基础库文档和片段。随后在管理页面对基础库执行“重建当前索引”，确认数据库片段数和新 collection 向量数一致。旧 `mindbridge_knowledge` collection 被保留，仅不再由应用查询。

## 管理接口

- `POST /api/admin/knowledge-bases`：创建知识库。
- `GET /api/admin/knowledge-bases`：名称、状态、创建时间筛选和分页。
- `GET/PATCH /api/admin/knowledge-bases/{id}`：详情与编辑；仅可将状态改为 `active` 或 `disabled`。
- `DELETE /api/admin/knowledge-bases/{id}`：逻辑删除。
- `POST /api/admin/knowledge-bases/{id}/restore`：恢复；collection 缺失时转为 `error`，需重建。
- `DELETE /api/admin/knowledge-bases/{id}/purge`：仅已逻辑删除且没有检索日志引用时物理删除。失败保留错误状态和操作日志，可修复 Chroma 后重试。
- `POST /api/admin/knowledge-bases/{id}/documents`、`GET .../{id}/status`、`POST .../{id}/rebuild`：知识库级文档和索引操作。

所有接口要求管理员 Basic Auth。物理删除不支持 `force`；存在检索引用会返回 HTTP 409。

## 运行与验证

```bash
docker compose config
docker compose up -d --build
cd frontend && npm run typecheck && npm run build
```

在 `http://localhost:3000/admin/knowledge` 创建知识库后，上传相同文件名到两个不同知识库，再分别重建并查询，可验证其文档、片段和 collection 相互隔离。

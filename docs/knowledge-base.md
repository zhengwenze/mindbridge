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
- `DELETE /api/admin/knowledge-bases/{id}`：校验引用并进入删除屏障，再清理独立 collection、原文件和数据库记录；失败保留 `DELETE_FAILED` 和操作日志，可修复后重试。
- `POST/GET /api/admin/knowledge-bases/{id}/documents`：上传或聚合查询知识库下的文档。
- `POST .../{id}/documents/{document_id}/split-preview`：无副作用预览字符拆分结果。
- `POST .../{id}/documents/{document_id}/reindex`：应用逐文档拆分配置并替换索引。
- `DELETE .../{id}/documents/{document_id}`、`POST .../{id}/documents/batch-delete`：单删或最多 100 个文档的全成全败批删。
- `GET .../{id}/status`、`POST .../{id}/rebuild`：知识库级状态与索引重建。

所有接口要求管理员 Basic Auth。知识库删除不支持 `force`；存在检索引用会返回 HTTP 409。

## 文档上传与管理

管理员页面 `http://localhost:3000/admin/docs` 支持拖拽、多文件选择和文件夹选择。一个上传队列固定归属一个状态为 `active` 的知识库，默认同时处理两个文件，并分别显示上传百分比和后端解析入库状态。

上传接口使用 `multipart/form-data`：

```bash
curl -u admin:admin123 \
  -F 'file=@./guide.pdf' \
  -F 'relative_path=制度/guide.pdf' \
  -F 'chunk_size=512' \
  -F 'chunk_overlap=64' \
  -F 'splitter_type=recursive_character' \
  http://127.0.0.1:8000/api/admin/knowledge-bases/1/documents
```

- `file` 为必填文件字段，`relative_path` 和拆分参数可选；未传拆分参数时使用系统字符数默认值。
- 支持 `.txt`、`.md`、`.markdown`、`.pdf`、`.docx`，不支持旧版 `.doc` 和扫描 PDF OCR。
- TXT/Markdown 保留标题、列表和换行；DOCX 保留段落顺序并转换标题、列表和表格；PDF 保留页边界。
- 服务端以 1 MiB 分块接收，单文件默认最多 50 MB；DOCX 解压内容默认最多 200 MB。
- 相对路径会写入 `knowledge_documents.relative_path`，磁盘文件仍使用 UUID 安全命名。
- 同一知识库内相对路径唯一；重复上传返回 409，不覆盖已有文档。不同文件夹下的同名文件可以共存。
- 413 表示文件过大，415 表示格式不支持，422 表示路径、编码或文档内容无法解析，503 表示索引依赖处理失败。
- 上传任一步失败都会清理临时文件、数据库新记录和已写入的文档向量，之后可以直接重试。
- 文档管理页从 MySQL 聚合 Chunk 数，不逐行访问 Chroma；拆分预览不写数据库或向量库。
- reindex 先生成全部新 embedding，再按旧 Chunk 精确 ID 替换；失败时清理新向量并恢复实际旧 Chroma 记录。

相关配置：

```env
KNOWLEDGE_UPLOAD_MAX_BYTES=52428800
KNOWLEDGE_UPLOAD_READ_CHUNK_BYTES=1048576
KNOWLEDGE_DOCX_MAX_UNCOMPRESSED_BYTES=209715200
KNOWLEDGE_EMBEDDING_BATCH_SIZE=32
KNOWLEDGE_CHUNK_SIZE=512
KNOWLEDGE_CHUNK_OVERLAP=64
KNOWLEDGE_SPLIT_PREVIEW_MAX_CHUNKS=200
```

详细契约和补偿时序见[知识库文档管理第一阶段](knowledge/document-management-phase-1.md)。

## 运行与验证

```bash
docker compose config
docker compose up -d --build
cd frontend && npm run typecheck && npm run build
```

在 `http://localhost:3000/admin/knowledge` 创建知识库，再到 `http://localhost:3000/admin/docs` 上传文档。向两个知识库上传相同文件，或向一个知识库上传 `A/说明.txt` 与 `B/说明.txt`，再分别查询，可验证文档、片段和 collection 相互隔离。

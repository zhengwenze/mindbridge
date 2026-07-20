from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agents.factory import agent_framework_status
from app.agents.runtime import AgentRuntimeService
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    current_user,
    hash_password,
    require_admin,
    require_student,
)
from app.models.entities import KnowledgeChunk, KnowledgeDocument, UserAccount
from app.schemas.dtos import (
    ChatRequest,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    KnowledgeBaseCreateRequest,
    KnowledgeBaseUpdateRequest,
    StudentDocumentPreviewResponse,
    StudentRegisterRequest,
    authority,
)
from app.schemas.knowledge import DocumentBatchDeleteRequest, DocumentSplitRequest
from app.services.chat import ChatService
from app.services.document_management import KnowledgeDocumentService, receive_upload
from app.services.knowledge import KnowledgeBaseError, KnowledgeBaseService
from app.services.model_assets import finetuned_model_status
from app.services.report import ReportService
from app.services.skills import MindBridgeSkillLibrary

router = APIRouter()


def profile_response(user: UserAccount):
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "roles": [authority(role) for role in user.roles],
    }


def admin_user_response(user: UserAccount):
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": "ROLE_ADMIN" if "ROLE_ADMIN" in user.roles else "ROLE_USER",
        "createdAt": user.created_at,
    }


@router.get("/actuator/health", tags=["System"], summary="服务健康检查")
def health():
    return {"status": "UP"}


@router.post(
    "/api/register/student",
    status_code=201,
    tags=["Authentication"],
    summary="注册学生账号",
)
def register_student(
    request: StudentRegisterRequest, db: Annotated[Session, Depends(get_db)]
):
    username = request.username.strip()
    if (
        db.query(UserAccount).filter(UserAccount.username == username).first()
        is not None
    ):
        raise HTTPException(409, "用户名已被注册")

    display_name = (request.displayName or username).strip() or username
    user = UserAccount(
        username=username,
        display_name=display_name,
        password_hash=hash_password(request.password),
    )
    user.roles = {"ROLE_USER"}
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "用户名已被注册") from exc

    db.refresh(user)
    return profile_response(user)


@router.get("/api/profile", tags=["Authentication"], summary="获取当前用户信息")
def profile(user: Annotated[UserAccount, Depends(current_user)]):
    return profile_response(user)


@router.get("/api/student/sessions", tags=["Student"], summary="查询学生会话列表")
def student_sessions(
    user: Annotated[UserAccount, Depends(require_student)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).student_sessions(user.id)


@router.get(
    "/api/student/sessions/{session_id}", tags=["Student"], summary="查询学生会话详情"
)
def student_conversation(
    session_id: str,
    user: Annotated[UserAccount, Depends(require_student)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return ReportService(db).student_conversation(user.id, session_id)
    except ValueError as exc:
        raise HTTPException(404, "Session not found") from exc


@router.get(
    "/api/student/documents/{document_id}",
    response_model=StudentDocumentPreviewResponse,
    tags=["Student"],
    summary="预览学生可访问的知识文档",
)
def student_document_preview(
    document_id: int,
    user: Annotated[UserAccount, Depends(require_student)],
    db: Annotated[Session, Depends(get_db)],
    chunk_id: int | None = Query(default=None, ge=1),
):
    document = (
        db.query(KnowledgeDocument)
        .filter(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.deleted_at.is_(None),
            KnowledgeDocument.index_status == "active",
        )
        .first()
    )
    if document is None:
        raise HTTPException(404, "文档不存在或暂不可用")
    highlight = None
    if chunk_id is not None:
        chunk = (
            db.query(KnowledgeChunk)
            .filter(
                KnowledgeChunk.id == chunk_id,
                KnowledgeChunk.document_id == document.id,
            )
            .first()
        )
        if chunk is not None:
            highlight = chunk.content
    return StudentDocumentPreviewResponse(
        documentId=document.id,
        knowledgeBaseId=document.knowledge_base_id,
        fileName=document.file_name,
        fileType=document.file_type,
        content=document.parsed_content or "",
        highlight=highlight,
    )


@router.post("/api/chat/stream", tags=["Chat"], summary="发起 SSE 流式对话")
async def chat_stream(
    request: ChatRequest,
    user: Annotated[UserAccount, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if "ROLE_ADMIN" in user.roles:
        raise HTTPException(403, "管理员账号只能查看后台记录，不能发起学生对话。")
    service = ChatService(db, get_settings())
    return StreamingResponse(
        service.stream_chat(user, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/agent/status", tags=["System"], summary="查询 Agent 运行状态")
def agent_status(user: Annotated[UserAccount, Depends(current_user)]):
    settings = get_settings()
    provider = settings.ai_provider.lower()
    model = (
        settings.ollama_model
        if provider == "ollama"
        else settings.openai_model if provider == "openai" else "mock"
    )
    framework = agent_framework_status(settings)
    return {
        "provider": provider,
        "model": model,
        "realModelEnabled": provider in {"ollama", "openai"},
        "agentFramework": framework,
        "finetunedModel": finetuned_model_status(settings),
        "agents": [
            {
                "name": "CoordinatorAgent",
                "status": "READY",
                "description": "维护任务板、预算、安全门槛、冲突仲裁和最终采纳",
            },
            {
                "name": "UnderstandingAgent",
                "status": "READY",
                "description": "独立理解用户输入，发布 intent artifact",
            },
            {
                "name": "SafetyAgent",
                "status": "READY",
                "description": "独立风险评估、SAFETY_OVERRIDE 和候选回复安全审查",
            },
            {
                "name": "ContextAgent",
                "status": "READY",
                "description": "独立记忆视图、RAG 检索和 skill 上下文聚合",
            },
            {
                "name": "ResponseAgent",
                "status": "READY",
                "description": "根据黑板 artifact 发布候选回复方案",
            },
        ],
        "skills": MindBridgeSkillLibrary.status_items(),
        "runtimeHarness": {
            "name": "MindBridgeAgentHarness",
            "status": "READY",
            "description": "统一管理单轮 Agent run 的输入脱敏、上下文注入、风险报告、工具计划和 trace 输出",
        },
        "loop": {
            "type": (
                "event-driven-multi-agent"
                if framework["active"] == "event_driven_multi_agent"
                else "bounded-agent-loop"
            ),
            "maxSteps": AgentRuntimeService.max_steps,
            "scheduler": (
                "claim-based-actor-runtime"
                if framework["active"] == "event_driven_multi_agent"
                else (
                    "langgraph-controller"
                    if framework["active"] == "langgraph"
                    else "custom-runtime"
                )
            ),
        },
        "collaboration": {
            "scheduler": "claim-based",
            "state": "append-only-blackboard",
            "messageBus": "per-agent inbox over shared mailbox",
            "fixedWorkflow": False,
            "agentIsolation": {
                "prompt": "per-agent system prompt",
                "memory": "per-agent private Redis key",
                "model": "per-agent model profile",
                "tools": "per-agent tool permissions",
            },
        },
    }


@router.get("/api/reports/me", tags=["Student"], summary="查询当前学生报告")
def my_reports(
    user: Annotated[UserAccount, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).latest_reports(user.id)


@router.get("/api/admin/reports", tags=["Administration"], summary="查询风险报告")
def admin_reports(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).latest_reports()


@router.get(
    "/api/admin/excel-records", tags=["Administration"], summary="查询 Excel 导出记录"
)
def admin_excel(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).excel_records()


@router.get("/api/admin/alerts", tags=["Administration"], summary="查询告警记录")
def admin_alerts(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).alert_records()


@router.get("/api/admin/cases", tags=["Administration"], summary="查询风险案例")
def admin_cases(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).risk_cases()


@router.get(
    "/api/admin/cases/{case_id}/notes",
    tags=["Administration"],
    summary="查询案例跟进记录",
)
def admin_case_notes(
    case_id: int,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).case_notes(case_id)


@router.get("/api/admin/tool-jobs", tags=["Administration"], summary="查询工具任务")
def admin_tool_jobs(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).tool_jobs()


@router.get("/api/admin/dead-letters", tags=["Administration"], summary="查询失败任务")
def admin_dead_letters(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).dead_letters()


@router.get(
    "/api/admin/agent-traces", tags=["Administration"], summary="查询 Agent 运行轨迹"
)
def admin_agent_traces(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).agent_run_traces()


@router.get(
    "/api/admin/tool-audits", tags=["Administration"], summary="查询工具审计记录"
)
def admin_tool_audits(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return ReportService(db).tool_audits()


@router.get(
    "/api/admin/conversations/{session_id}",
    tags=["Administration"],
    summary="查询后台会话详情",
)
def admin_conversation(
    session_id: str,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return ReportService(db).conversation(session_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/api/admin/users", tags=["Administration"], summary="分页查询用户")
def list_admin_users(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    username: str | None = None,
    role: str | None = Query(default=None, pattern=r"^ROLE_(USER|ADMIN)$"),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query = db.query(UserAccount)
    if username:
        query = query.filter(UserAccount.username.like(f"%{username.strip()}%"))
    if role:
        query = query.filter(UserAccount.roles_csv.like(f"%{role}%"))
    if created_from:
        query = query.filter(UserAccount.created_at >= created_from)
    if created_to:
        query = query.filter(UserAccount.created_at <= created_to)
    total = query.count()
    items = (
        query.order_by(UserAccount.created_at.desc(), UserAccount.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [admin_user_response(user) for user in items],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@router.post(
    "/api/admin/users", status_code=201, tags=["Administration"], summary="创建用户"
)
def create_admin_user(
    request: AdminUserCreateRequest,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    username = request.username.strip()
    if (
        db.query(UserAccount).filter(UserAccount.username == username).first()
        is not None
    ):
        raise HTTPException(409, "用户名已存在")
    user = UserAccount(
        username=username,
        display_name=(request.displayName or username).strip() or username,
        password_hash=hash_password(request.password),
    )
    user.roles = {request.role}
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "用户名已存在") from exc
    db.refresh(user)
    return admin_user_response(user)


@router.patch("/api/admin/users/{user_id}", tags=["Administration"], summary="更新用户")
def update_admin_user(
    user_id: int,
    request: AdminUserUpdateRequest,
    actor: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if user is None:
        raise HTTPException(404, "用户不存在")
    if request.displayName is not None:
        user.display_name = request.displayName.strip() or user.username
    if request.password:
        user.password_hash = hash_password(request.password)
    if request.role:
        if user.id == actor.id and request.role != "ROLE_ADMIN":
            raise HTTPException(400, "不能移除当前管理员的管理员角色")
        user.roles = {request.role}
    db.commit()
    db.refresh(user)
    return admin_user_response(user)


@router.delete(
    "/api/admin/users/{user_id}", tags=["Administration"], summary="删除用户"
)
def delete_admin_user(
    user_id: int,
    actor: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    if user_id == actor.id:
        raise HTTPException(400, "不能删除当前登录管理员")
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if user is None:
        raise HTTPException(404, "用户不存在")
    db.delete(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "该用户存在关联业务数据，无法删除") from exc
    return {"deleted": True, "id": user_id}


def knowledge_error(exc: KnowledgeBaseError) -> HTTPException:
    return HTTPException(exc.status_code, exc.detail or str(exc))


@router.post(
    "/api/admin/knowledge-bases",
    status_code=201,
    tags=["Knowledge Bases"],
    summary="创建知识库",
)
def create_knowledge_base(
    request: KnowledgeBaseCreateRequest,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        base = KnowledgeBaseService(db, get_settings()).create(
            request.name, request.description, user
        )
        return KnowledgeBaseService(db, get_settings()).detail(base.id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.get(
    "/api/admin/knowledge-bases", tags=["Knowledge Bases"], summary="分页查询知识库"
)
def list_knowledge_bases(
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    name: str | None = None,
    status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    include_deleted: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return KnowledgeBaseService(db, get_settings()).list(
        name=name,
        status=status,
        created_from=created_from,
        created_to=created_to,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/api/admin/knowledge-bases/{knowledge_base_id}",
    tags=["Knowledge Bases"],
    summary="查询知识库详情",
)
def knowledge_base_detail(
    knowledge_base_id: int,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    include_deleted: bool = False,
):
    try:
        return KnowledgeBaseService(db, get_settings()).detail(
            knowledge_base_id, include_deleted
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.patch(
    "/api/admin/knowledge-bases/{knowledge_base_id}",
    tags=["Knowledge Bases"],
    summary="更新知识库",
)
def update_knowledge_base(
    knowledge_base_id: int,
    request: KnowledgeBaseUpdateRequest,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        base = KnowledgeBaseService(db, get_settings()).update(
            knowledge_base_id,
            name=request.name,
            description=request.description,
            status=request.status,
            actor=user,
        )
        return KnowledgeBaseService(db, get_settings()).detail(base.id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.delete(
    "/api/admin/knowledge-bases/{knowledge_base_id}",
    tags=["Knowledge Bases"],
    summary="删除知识库",
)
def delete_knowledge_base(
    knowledge_base_id: int,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeBaseService(db, get_settings()).delete(knowledge_base_id, user)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.get(
    "/api/admin/knowledge-bases/{knowledge_base_id}/status",
    tags=["Knowledge Bases"],
    summary="查询知识库索引状态",
)
def knowledge_base_status(
    knowledge_base_id: int,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeBaseService(db, get_settings()).status(knowledge_base_id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents",
    status_code=201,
    tags=["Knowledge Bases"],
    summary="上传并索引知识文档",
)
async def ingest_knowledge_document(
    knowledge_base_id: int,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    relative_path: str | None = Form(default=None),
    chunk_size: int | None = Form(default=None, ge=100, le=4000),
    chunk_overlap: int | None = Form(default=None, ge=0, le=1000),
    splitter_type: str = Form(default="recursive_character"),
):
    temp_path = None
    try:
        settings = get_settings()
        temp_path, file_size = await receive_upload(file, settings)
        return KnowledgeDocumentService(db, settings).ingest_path(
            knowledge_base_id,
            file.filename or "uploaded-file",
            relative_path,
            temp_path,
            file_size,
            user,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            splitter_type=splitter_type,
            mime_type=file.content_type,
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@router.get(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents",
    tags=["Knowledge Bases"],
    summary="分页查询知识文档",
)
def list_knowledge_documents(
    knowledge_base_id: int,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    name: str | None = None,
    status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    try:
        return KnowledgeDocumentService(db, get_settings()).list(
            knowledge_base_id,
            name=name,
            status=status,
            created_from=created_from,
            created_to=created_to,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents/batch-delete",
    tags=["Knowledge Bases"],
    summary="批量删除知识文档",
)
def batch_delete_knowledge_documents(
    knowledge_base_id: int,
    request: DocumentBatchDeleteRequest,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeDocumentService(db, get_settings()).batch_delete(
            knowledge_base_id, request.documentIds, user
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents/{document_id}/split-preview",
    tags=["Knowledge Bases"],
    summary="预览文档切分结果",
)
def preview_knowledge_document_split(
    knowledge_base_id: int,
    document_id: int,
    request: DocumentSplitRequest,
    _: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeDocumentService(db, get_settings()).split_preview(
            knowledge_base_id,
            document_id,
            chunk_size=request.chunkSize,
            chunk_overlap=request.chunkOverlap,
            splitter_type=request.splitterType,
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents/{document_id}/reindex",
    tags=["Knowledge Bases"],
    summary="重新切分并索引文档",
)
def reindex_knowledge_document(
    knowledge_base_id: int,
    document_id: int,
    request: DocumentSplitRequest,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeDocumentService(db, get_settings()).reindex(
            knowledge_base_id,
            document_id,
            chunk_size=request.chunkSize,
            chunk_overlap=request.chunkOverlap,
            splitter_type=request.splitterType,
            actor=user,
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.delete(
    "/api/admin/knowledge-bases/{knowledge_base_id}/documents/{document_id}",
    tags=["Knowledge Bases"],
    summary="删除知识文档",
)
def delete_knowledge_document(
    knowledge_base_id: int,
    document_id: int,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return KnowledgeDocumentService(db, get_settings()).delete(
            knowledge_base_id, document_id, user
        )
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post(
    "/api/admin/knowledge-bases/{knowledge_base_id}/rebuild",
    tags=["Knowledge Bases"],
    summary="重建知识库索引",
)
def rebuild_knowledge_base(
    knowledge_base_id: int,
    user: Annotated[UserAccount, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return {
            "indexedChunks": KnowledgeDocumentService(db, get_settings()).rebuild(
                knowledge_base_id, user
            )
        }
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc

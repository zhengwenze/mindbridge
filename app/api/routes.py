from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agents.factory import agent_framework_status
from app.agents.runtime import AgentRuntimeService
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import current_user, hash_password, require_admin, require_student
from app.models.entities import UserAccount
from app.schemas.dtos import ChatRequest, KnowledgeBaseCreateRequest, KnowledgeBaseUpdateRequest, StudentRegisterRequest, authority
from app.services.chat import ChatService
from app.services.knowledge import KnowledgeBaseError, KnowledgeBaseService, KnowledgeDocumentService
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


@router.get("/actuator/health")
def health():
    return {"status": "UP"}


@router.post("/api/register/student", status_code=201)
def register_student(request: StudentRegisterRequest, db: Annotated[Session, Depends(get_db)]):
    username = request.username.strip()
    if db.query(UserAccount).filter(UserAccount.username == username).first() is not None:
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


@router.get("/api/profile")
def profile(user: Annotated[UserAccount, Depends(current_user)]):
    return profile_response(user)


@router.get("/api/student/sessions")
def student_sessions(user: Annotated[UserAccount, Depends(require_student)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).student_sessions(user.id)


@router.get("/api/student/sessions/{session_id}")
def student_conversation(session_id: str, user: Annotated[UserAccount, Depends(require_student)], db: Annotated[Session, Depends(get_db)]):
    try:
        return ReportService(db).student_conversation(user.id, session_id)
    except ValueError as exc:
        raise HTTPException(404, "Session not found") from exc


@router.post("/api/chat/stream")
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


@router.get("/api/agent/status")
def agent_status(user: Annotated[UserAccount, Depends(current_user)]):
    settings = get_settings()
    provider = settings.ai_provider.lower()
    model = settings.ollama_model if provider == "ollama" else settings.openai_model if provider == "openai" else "mock"
    framework = agent_framework_status(settings)
    return {
        "provider": provider,
        "model": model,
        "realModelEnabled": provider in {"ollama", "openai"},
        "agentFramework": framework,
        "finetunedModel": finetuned_model_status(settings),
        "agents": [
            {"name": "CoordinatorAgent", "status": "READY", "description": "维护任务板、预算、安全门槛、冲突仲裁和最终采纳"},
            {"name": "UnderstandingAgent", "status": "READY", "description": "独立理解用户输入，发布 intent artifact"},
            {"name": "SafetyAgent", "status": "READY", "description": "独立风险评估、SAFETY_OVERRIDE 和候选回复安全审查"},
            {"name": "ContextAgent", "status": "READY", "description": "独立记忆视图、RAG 检索和 skill 上下文聚合"},
            {"name": "ResponseAgent", "status": "READY", "description": "根据黑板 artifact 发布候选回复方案"},
        ],
        "skills": MindBridgeSkillLibrary.status_items(),
        "runtimeHarness": {
            "name": "MindBridgeAgentHarness",
            "status": "READY",
            "description": "统一管理单轮 Agent run 的输入脱敏、上下文注入、风险报告、工具计划和 trace 输出",
        },
        "loop": {
            "type": "event-driven-multi-agent" if framework["active"] == "event_driven_multi_agent" else "bounded-agent-loop",
            "maxSteps": AgentRuntimeService.max_steps,
            "scheduler": "claim-based-actor-runtime" if framework["active"] == "event_driven_multi_agent" else "langgraph-controller" if framework["active"] == "langgraph" else "custom-runtime",
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


@router.get("/api/reports/me")
def my_reports(user: Annotated[UserAccount, Depends(current_user)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).latest_reports(user.id)


@router.get("/api/admin/reports")
def admin_reports(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).latest_reports()


@router.get("/api/admin/excel-records")
def admin_excel(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).excel_records()


@router.get("/api/admin/alerts")
def admin_alerts(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).alert_records()


@router.get("/api/admin/cases")
def admin_cases(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).risk_cases()


@router.get("/api/admin/cases/{case_id}/notes")
def admin_case_notes(case_id: int, _: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).case_notes(case_id)


@router.get("/api/admin/tool-jobs")
def admin_tool_jobs(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).tool_jobs()


@router.get("/api/admin/dead-letters")
def admin_dead_letters(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).dead_letters()


@router.get("/api/admin/agent-traces")
def admin_agent_traces(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).agent_run_traces()


@router.get("/api/admin/tool-audits")
def admin_tool_audits(_: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    return ReportService(db).tool_audits()


@router.get("/api/admin/conversations/{session_id}")
def admin_conversation(session_id: str, _: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        return ReportService(db).conversation(session_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


def knowledge_error(exc: KnowledgeBaseError) -> HTTPException:
    return HTTPException(exc.status_code, exc.detail or str(exc))


@router.post("/api/admin/knowledge-bases", status_code=201)
def create_knowledge_base(request: KnowledgeBaseCreateRequest, user: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        base = KnowledgeBaseService(db, get_settings()).create(request.name, request.description, user)
        return KnowledgeBaseService(db, get_settings()).detail(base.id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.get("/api/admin/knowledge-bases")
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
    return KnowledgeBaseService(db, get_settings()).list(name=name, status=status, created_from=created_from, created_to=created_to, include_deleted=include_deleted, page=page, page_size=page_size)


@router.get("/api/admin/knowledge-bases/{knowledge_base_id}")
def knowledge_base_detail(knowledge_base_id: int, _: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)], include_deleted: bool = False):
    try:
        return KnowledgeBaseService(db, get_settings()).detail(knowledge_base_id, include_deleted)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.patch("/api/admin/knowledge-bases/{knowledge_base_id}")
def update_knowledge_base(knowledge_base_id: int, request: KnowledgeBaseUpdateRequest, user: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        base = KnowledgeBaseService(db, get_settings()).update(knowledge_base_id, name=request.name, description=request.description, status=request.status, actor=user)
        return KnowledgeBaseService(db, get_settings()).detail(base.id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.delete("/api/admin/knowledge-bases/{knowledge_base_id}")
def delete_knowledge_base(knowledge_base_id: int, user: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        return KnowledgeBaseService(db, get_settings()).delete(knowledge_base_id, user)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.get("/api/admin/knowledge-bases/{knowledge_base_id}/status")
def knowledge_base_status(knowledge_base_id: int, _: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        return KnowledgeBaseService(db, get_settings()).status(knowledge_base_id)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post("/api/admin/knowledge-bases/{knowledge_base_id}/documents", status_code=201)
async def ingest_knowledge_document(knowledge_base_id: int, user: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)], file: UploadFile = File(...)):
    try:
        return KnowledgeDocumentService(db, get_settings()).ingest_file(knowledge_base_id, file.filename or "uploaded-file", await file.read(), user)
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc


@router.post("/api/admin/knowledge-bases/{knowledge_base_id}/rebuild")
def rebuild_knowledge_base(knowledge_base_id: int, user: Annotated[UserAccount, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    try:
        return {"indexedChunks": KnowledgeDocumentService(db, get_settings()).rebuild(knowledge_base_id, user)}
    except KnowledgeBaseError as exc:
        raise knowledge_error(exc) from exc

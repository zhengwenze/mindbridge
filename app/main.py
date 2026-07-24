from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import router
from app.core.bootstrap import seed_data
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.tool_queue import get_tool_queue_worker

OPENAPI_TAGS = [
    {"name": "System", "description": "服务健康检查与运行状态。"},
    {"name": "Authentication", "description": "学生注册与当前用户身份信息。"},
    {"name": "Student", "description": "学生会话、文档预览与个人报告。"},
    {"name": "Chat", "description": "AI 对话与 Server-Sent Events 流式响应。"},
    {"name": "Administration", "description": "管理员审计、风险处置与用户管理。"},
    {"name": "Knowledge Bases", "description": "知识库、文档、切分与索引管理。"},
]


def create_app() -> FastAPI:
    app = FastAPI(
        title="MindBridge API",
        summary="MindBridge 后端接口",
        description=(
            "MindBridge 的学生对话、风险报告、后台管理和知识库接口。"
            "除健康检查与学生注册外，接口使用 HTTP Basic 认证；"
            "可在 Swagger UI 右上角通过 Authorize 输入账号和密码。"
        ),
        version="0.1.0",
        openapi_tags=OPENAPI_TAGS,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def no_cache_frontend_assets(request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path == "/" or path.endswith((".html", ".js", ".css")):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.on_event("startup")
    def startup() -> None:
        db = SessionLocal()
        try:
            seed_data(db)
        finally:
            db.close()
        worker = get_tool_queue_worker(get_settings())
        worker.start()
        app.state.tool_queue_worker = worker

    @app.on_event("shutdown")
    def shutdown() -> None:
        worker = getattr(app.state, "tool_queue_worker", None)
        if worker is not None:
            worker.stop()

    app.include_router(router)
    static_dir = Path(__file__).resolve().parent / "static"
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()

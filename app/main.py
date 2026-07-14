from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.bootstrap import seed_data
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.tool_queue import get_tool_queue_worker


def create_app() -> FastAPI:
    app = FastAPI(title="MindBridge Python", version="0.1.0")

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
    # The student frontend is developed and served independently. The legacy
    # bundled frontend is optional, so its removal must not prevent the API
    # application (including authentication) from starting.
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()

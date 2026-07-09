from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
if settings.database_url.lower().startswith("sqlite"):
    raise RuntimeError("SQLite is disabled. Start the Docker Compose MySQL service and use a mysql+pymysql DATABASE_URL.")

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
}

engine = create_engine(
    settings.database_url,
    **engine_kwargs,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def session_scope() -> Session:
    return SessionLocal()

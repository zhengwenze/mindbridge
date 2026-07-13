from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.security import hash_password
from app.models.entities import KnowledgeBase, UserAccount
from app.services.knowledge import BASE_KNOWLEDGE_NAME, KnowledgeBaseService, KnowledgeDocumentService


def create_schema() -> None:
    """Compatibility helper for legacy scripts; application startup uses Alembic."""
    Base.metadata.create_all(bind=engine)


def seed_data(db: Session) -> None:
    if db.query(UserAccount).count() == 0:
        admin = UserAccount(
            username="admin",
            display_name="Counselor Admin",
            password_hash=hash_password("admin123"),
        )
        admin.roles = {"ROLE_ADMIN", "ROLE_USER"}
        student = UserAccount(
            username="student",
            display_name="Demo Student",
            password_hash=hash_password("student123"),
        )
        student.roles = {"ROLE_USER"}
        db.add_all([admin, student])
        db.commit()

    settings = get_settings()
    admin = db.query(UserAccount).filter(UserAccount.username == "admin").first()
    bases = KnowledgeBaseService(db, settings)
    bases.ensure_defaults(admin)
    base = db.query(KnowledgeBase).filter_by(name=BASE_KNOWLEDGE_NAME, deleted_at=None).first()
    documents = KnowledgeDocumentService(db, settings)
    root = Path(__file__).resolve().parents[1]
    for file in sorted((root / "knowledge").glob("*.md")):
        documents.ensure_source(base.id, file.name, file.read_text(encoding="utf-8"))

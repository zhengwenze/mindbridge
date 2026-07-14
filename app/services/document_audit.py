from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models.entities import KnowledgeBaseOperationLog, KnowledgeDocument, UserAccount
from app.services.knowledge import safe_error


logger = logging.getLogger(__name__)


class DocumentOperationRecorder:
    """Persist document management outcomes without storing document content."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def audit(
        self,
        knowledge_base_id: int,
        actor: UserAccount | None,
        action: str,
        status: str,
        detail: dict,
    ) -> None:
        self.db.add(
            KnowledgeBaseOperationLog(
                knowledge_base_id=knowledge_base_id,
                actor_id=actor.id if actor else None,
                action=action,
                status=status,
                detail_json=json.dumps(detail, ensure_ascii=False),
            )
        )

    def best_effort_audit(
        self,
        knowledge_base_id: int,
        actor: UserAccount | None,
        action: str,
        status: str,
        detail: dict,
    ) -> None:
        """Write a post-commit audit without turning a completed action into an API error."""

        try:
            self.audit(knowledge_base_id, actor, action, status, detail)
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("failed to write post-commit document operation audit")

    def upload_failure(
        self,
        knowledge_base_id: int,
        actor: UserAccount | None,
        action: str,
        relative_path: str,
        exc: Exception,
        extra: dict | None = None,
    ) -> None:
        try:
            detail = {"relativePath": relative_path, "error": safe_error(exc)}
            detail.update(extra or {})
            self.audit(knowledge_base_id, actor, action, "error", detail)
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("failed to write document operation audit")

    def reindex_failure(
        self,
        knowledge_base_id: int,
        document_id: int,
        actor: UserAccount | None,
        action: str,
        exc: Exception,
        compensation_error: Exception | None,
    ) -> None:
        try:
            document = self.db.query(KnowledgeDocument).filter(
                KnowledgeDocument.id == document_id,
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            ).first()
            if document is not None and compensation_error is not None:
                document.index_status = "error"
                document.error_message = "重新索引失败且向量补偿未完整完成"
            self.audit(
                knowledge_base_id,
                actor,
                action,
                "error",
                {
                    "documentId": document_id,
                    "error": safe_error(exc),
                    "compensationError": safe_error(compensation_error)
                    if compensation_error
                    else "",
                },
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("failed to record reindex failure")

    def delete_failure(
        self,
        knowledge_base_id: int,
        document_ids: list[int],
        actor: UserAccount,
        action: str,
        exc: Exception,
        compensation_error: Exception | None,
    ) -> None:
        try:
            if compensation_error is not None:
                self.db.query(KnowledgeDocument).filter(
                    KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                    KnowledgeDocument.id.in_(document_ids),
                ).update(
                    {
                        KnowledgeDocument.index_status: "error",
                        KnowledgeDocument.error_message: "删除失败且向量补偿未完整完成",
                    },
                    synchronize_session=False,
                )
            self.audit(
                knowledge_base_id,
                actor,
                action,
                "error",
                {
                    "documentIds": document_ids,
                    "error": safe_error(exc),
                    "compensationError": safe_error(compensation_error)
                    if compensation_error
                    else "",
                },
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("failed to record document deletion failure")

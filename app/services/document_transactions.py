from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.entities import KnowledgeChunk, KnowledgeDocument


class CommitOutcomeUnknown(RuntimeError):
    """Raised when a commit failed and its durable outcome cannot be proven."""


@dataclass(frozen=True)
class DocumentVersionExpectation:
    document_id: int
    previous_revision: int | None
    revision: int
    chunk_ids: tuple[int, ...]


def commit_document_version(
    db: Session, expectation: DocumentVersionExpectation
) -> None:
    """Commit a document replacement and verify an ambiguous commit ACK.

    Compensation is only safe when a fresh connection proves that the new
    version was not committed. If verification itself is inconclusive, the
    caller must surface an operation-unknown error instead of deleting either
    the old or new external resources.
    """

    bind = db.get_bind()
    commit_error: Exception | None = None
    try:
        db.commit()
        return
    except Exception as exc:
        commit_error = exc
        try:
            db.rollback()
        except Exception:
            pass
    assert commit_error is not None

    try:
        with Session(bind=bind) as verifier:
            document = verifier.get(KnowledgeDocument, expectation.document_id)
            current_ids = (
                tuple(
                    row[0]
                    for row in verifier.query(KnowledgeChunk.id)
                    .filter(KnowledgeChunk.document_id == expectation.document_id)
                    .order_by(KnowledgeChunk.id)
                    .all()
                )
                if document is not None
                else ()
            )
    except Exception as verify_error:
        raise CommitOutcomeUnknown(
            "数据库提交结果无法确认，已停止自动补偿以避免误删已提交资源"
        ) from verify_error

    # A missing freshly-created document, or the exact previous revision, proves
    # that the transaction did not become durable and compensation is safe.
    if document is None:
        if expectation.previous_revision is None:
            raise commit_error
        raise CommitOutcomeUnknown("数据库提交结果无法确认，文档意外消失")

    current_revision = int(document.revision)
    expected_ids = tuple(sorted(expectation.chunk_ids))
    if (
        current_revision == expectation.revision
        and document.index_status == "active"
        and current_ids == expected_ids
    ):
        return
    if current_revision > expectation.revision:
        # A later committed revision proves this operation committed first.
        return
    if (
        expectation.previous_revision is not None
        and current_revision == expectation.previous_revision
    ):
        raise commit_error
    raise CommitOutcomeUnknown(
        "数据库提交结果无法确认，已停止自动补偿以避免误删已提交资源"
    )


def commit_document_deletion(db: Session, document_ids: list[int]) -> None:
    """Commit an atomic delete and verify an ambiguous commit ACK."""

    bind = db.get_bind()
    commit_error: Exception | None = None
    try:
        db.commit()
        return
    except Exception as exc:
        commit_error = exc
        try:
            db.rollback()
        except Exception:
            pass
    assert commit_error is not None

    try:
        with Session(bind=bind) as verifier:
            remaining = verifier.query(KnowledgeDocument.id).filter(
                KnowledgeDocument.id.in_(document_ids)
            ).count()
    except Exception as verify_error:
        raise CommitOutcomeUnknown(
            "数据库删除提交结果无法确认，已停止自动补偿以避免产生孤儿资源"
        ) from verify_error
    if remaining == 0:
        return
    if remaining == len(document_ids):
        raise commit_error
    raise CommitOutcomeUnknown(
        "数据库返回了非原子的批量删除结果，已停止自动补偿"
    )

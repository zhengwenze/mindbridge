from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import KnowledgeChunk, KnowledgeDocument
from app.services.document_splitter import (
    SplitterConfigError,
    split_text,
    validate_splitter_config,
)
from app.services.knowledge import (
    KnowledgeBaseNotFound,
    KnowledgeBaseService,
    KnowledgeDocumentInvalid,
)


class DocumentCatalog:
    """Read-only document listing, scoping and split preview."""

    def __init__(self, db: Session, settings: Settings) -> None:
        self.db = db
        self.settings = settings
        self.bases = KnowledgeBaseService(db, settings)

    def list(
        self,
        knowledge_base_id: int,
        *,
        name: str | None = None,
        status: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> dict:
        self.bases.get(knowledge_base_id)
        chunk_counts = (
            self.db.query(
                KnowledgeChunk.document_id.label("document_id"),
                func.count(KnowledgeChunk.id).label("chunk_count"),
            )
            .group_by(KnowledgeChunk.document_id)
            .subquery()
        )
        chunk_count = func.coalesce(chunk_counts.c.chunk_count, 0)
        query = (
            self.db.query(KnowledgeDocument, chunk_count)
            .outerjoin(chunk_counts, chunk_counts.c.document_id == KnowledgeDocument.id)
            .filter(
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.deleted_at.is_(None),
            )
        )
        if name:
            query = query.filter(KnowledgeDocument.file_name.ilike(f"%{name.strip()}%"))
        if status:
            query = query.filter(KnowledgeDocument.index_status == status)
        if created_from:
            query = query.filter(KnowledgeDocument.created_at >= created_from)
        if created_to:
            query = query.filter(KnowledgeDocument.created_at <= created_to)

        total = query.count()
        sort_columns = {
            "created_at": KnowledgeDocument.created_at,
            "updated_at": KnowledgeDocument.updated_at,
            "file_name": KnowledgeDocument.file_name,
            "file_size": KnowledgeDocument.file_size,
            "index_status": KnowledgeDocument.index_status,
            "indexed_at": KnowledgeDocument.indexed_at,
            "chunk_count": chunk_count,
        }
        if sort_by not in sort_columns:
            raise KnowledgeDocumentInvalid("不支持的文档排序字段")
        if sort_order not in {"asc", "desc"}:
            raise KnowledgeDocumentInvalid("sort_order 仅支持 asc 或 desc")
        direction = getattr(sort_columns[sort_by], sort_order)()
        stable_id = KnowledgeDocument.id.asc() if sort_order == "asc" else KnowledgeDocument.id.desc()
        rows = query.order_by(direction, stable_id).offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [serialize_document(document, int(count)) for document, count in rows],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def split_preview(
        self,
        knowledge_base_id: int,
        document_id: int,
        *,
        chunk_size: int,
        chunk_overlap: int,
        splitter_type: str,
    ) -> dict:
        try:
            config = validate_splitter_config(chunk_size, chunk_overlap, splitter_type)
        except SplitterConfigError as exc:
            raise KnowledgeDocumentInvalid(str(exc)) from exc
        document = self.get_scoped_document(knowledge_base_id, document_id)
        if not (document.parsed_content or "").strip():
            raise KnowledgeDocumentInvalid("该历史文档没有可用于预览的解析文本")
        chunks = split_text(document.parsed_content, config)
        limit = max(1, self.settings.knowledge_split_preview_max_chunks)
        return {
            "totalChunks": len(chunks),
            "items": [
                {"index": index, "content": content, "charCount": len(content)}
                for index, content in enumerate(chunks[:limit])
            ],
            "truncated": len(chunks) > limit,
        }

    def get_scoped_document(
        self, knowledge_base_id: int, document_id: int
    ) -> KnowledgeDocument:
        self.bases.get(knowledge_base_id)
        document = self.db.query(KnowledgeDocument).filter(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            KnowledgeDocument.deleted_at.is_(None),
        ).first()
        if document is None:
            raise KnowledgeBaseNotFound("文档不存在")
        return document


def serialize_document(document: KnowledgeDocument, chunk_count: int) -> dict:
    return {
        "id": document.id,
        "knowledgeBaseId": document.knowledge_base_id,
        "fileName": document.file_name,
        "relativePath": document.relative_path,
        "fileType": document.file_type,
        "mimeType": document.mime_type,
        "fileSize": document.file_size,
        "indexStatus": document.index_status,
        "errorMessage": document.error_message,
        "chunkCount": chunk_count,
        "chunkSize": document.chunk_size,
        "chunkOverlap": document.chunk_overlap,
        "splitterType": document.splitter_type,
        "createdAt": document.created_at,
        "updatedAt": document.updated_at,
        "indexedAt": document.indexed_at,
    }


def upload_response(
    document: KnowledgeDocument, chunk_count: int, warnings: list[str]
) -> dict:
    return {
        "id": document.id,
        "knowledgeBaseId": document.knowledge_base_id,
        "fileName": document.file_name,
        "relativePath": document.relative_path,
        "fileSize": document.file_size,
        "chunks": chunk_count,
        "indexStatus": document.index_status,
        "parserName": document.parser_name,
        "splitterType": document.splitter_type,
        "chunkSize": document.chunk_size,
        "chunkOverlap": document.chunk_overlap,
        "contentHash": document.content_hash,
        "warnings": list(warnings),
    }

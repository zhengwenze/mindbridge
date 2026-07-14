from __future__ import annotations

import hashlib
import logging
import mimetypes
from datetime import datetime
from pathlib import Path, PurePosixPath

from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings
from app.models.entities import (
    KnowledgeBase,
    KnowledgeChunk,
    KnowledgeDocument,
    UserAccount,
)
from app.services.document_parser import DocumentParseError, ParsedDocument, parse_document
from app.services.document_audit import DocumentOperationRecorder
from app.services.document_catalog import DocumentCatalog, upload_response
from app.services.document_indexing import DocumentIndexGateway, VectorCompensation
from app.services.document_splitter import (
    SplitterConfig,
    SplitterConfigError,
    split_text,
    validate_splitter_config,
)
from app.services.document_storage import (
    QuarantineError,
    cleanup_quarantine,
    create_upload_temp,
    move_upload_to_storage,
    quarantine_document_files,
    receive_upload,
    remove_stored_file,
    restore_files,
)
from app.services.document_transactions import (
    CommitOutcomeUnknown,
    DocumentVersionExpectation,
    commit_document_deletion,
    commit_document_version,
)
from app.services.knowledge import (
    KnowledgeBaseConflict,
    KnowledgeBaseError,
    KnowledgeBaseNotFound,
    KnowledgeBaseService,
    KnowledgeBaseUnavailable,
    KnowledgeDocumentInvalid,
    KnowledgeDocumentProcessingError,
    KnowledgeDocumentTooLarge,
    KnowledgeDocumentUnsupported,
    file_type,
    normalize_relative_path,
    safe_error,
    validate_document_extension,
)
from app.services.vector_store import ChromaVectorStore


logger = logging.getLogger(__name__)


class KnowledgeDocumentService:
    """Document-level orchestration across MySQL, Chroma and local files."""

    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.bases = KnowledgeBaseService(db, settings)
        self.vector_store: ChromaVectorStore = self.bases.vector_store
        self.index = DocumentIndexGateway(db, settings, self.vector_store)
        self.catalog = DocumentCatalog(db, settings)
        self.recorder = DocumentOperationRecorder(db)

    def ingest_file(
        self,
        knowledge_base_id: int,
        filename: str,
        data: bytes,
        actor: UserAccount | None = None,
        *,
        relative_path: str | None = None,
        replace_existing: bool = False,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        splitter_type: str = "recursive_character",
        mime_type: str | None = None,
    ) -> dict:
        if len(data) > self.settings.knowledge_upload_max_bytes:
            raise KnowledgeDocumentTooLarge("单个文件超过允许的上传大小")
        temp_path = create_upload_temp(self.settings, Path(filename).suffix)
        try:
            temp_path.write_bytes(data)
            return self.ingest_path(
                knowledge_base_id,
                filename,
                relative_path,
                temp_path,
                len(data),
                actor,
                replace_existing=replace_existing,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                splitter_type=splitter_type,
                mime_type=mime_type,
            )
        finally:
            temp_path.unlink(missing_ok=True)

    def ingest_path(
        self,
        knowledge_base_id: int,
        filename: str,
        relative_path: str | None,
        temp_path: Path,
        file_size: int,
        actor: UserAccount | None = None,
        *,
        replace_existing: bool = False,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        splitter_type: str = "recursive_character",
        mime_type: str | None = None,
    ) -> dict:
        initial_base = self.bases.get(knowledge_base_id)
        self._assert_writable(initial_base)
        normalized_path = normalize_relative_path(relative_path, filename)
        safe_name = PurePosixPath(normalized_path).name
        validate_document_extension(safe_name)
        config = self._config(chunk_size, chunk_overlap, splitter_type)
        parsed = self._parse(temp_path, safe_name)
        chunks = split_text(parsed.text, config)
        if not chunks:
            raise KnowledgeDocumentInvalid("文档没有可索引文本")

        # Generate every new embedding before acquiring IDs or touching the
        # currently active document version.
        try:
            embeddings = self.index.embed_all(chunks)
        except Exception as exc:
            self.db.rollback()
            self.recorder.upload_failure(initial_base.id, actor, "upload", normalized_path, exc)
            raise KnowledgeDocumentProcessingError(
                "文档 embedding 生成失败，请恢复向量服务后重试"
            ) from exc
        resolved_mime = (mime_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream")[:255]

        base = self._lock_writable_base(knowledge_base_id)
        existing = (
            self.db.query(KnowledgeDocument)
            .filter(
                KnowledgeDocument.knowledge_base_id == base.id,
                KnowledgeDocument.relative_path == normalized_path,
                KnowledgeDocument.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )
        if existing is not None and not replace_existing:
            self.db.rollback()
            raise KnowledgeBaseConflict("该知识库中已存在相同路径的文档")
        if existing is not None:
            return self._replace_locked_document(
                base,
                existing,
                parsed,
                config,
                chunks,
                embeddings,
                actor,
                action="replace",
                temp_path=temp_path,
                file_size=file_size,
                mime_type=resolved_mime,
            )

        document = KnowledgeDocument(
            knowledge_base_id=base.id,
            file_name=safe_name,
            relative_path=normalized_path,
            file_type=file_type(safe_name),
            mime_type=resolved_mime,
            file_size=file_size,
            parsed_content=parsed.text,
            content_hash=_content_hash(parsed.text),
            parser_name=parsed.parser_name,
            parser_version=parsed.parser_version,
            splitter_type=config.splitter_type,
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            revision=1,
            index_status="indexing",
            error_message="",
        )
        stored_path: Path | None = None
        new_ids: list[int] = []
        self.db.add(document)
        try:
            self.db.flush()
            rows = self._new_chunk_rows(base.id, document, normalized_path, chunks)
            self.db.add_all(rows)
            self.db.flush()
            new_ids = [int(row.id) for row in rows if row.id is not None]
            self.index.upsert_rows(base, rows, embeddings)
            stored_path = move_upload_to_storage(temp_path, base.id, safe_name, self.settings)
            document.storage_path = str(stored_path.relative_to(self.settings.project_root))
            document.index_status = "active"
            document.indexed_at = datetime.utcnow()
            self.recorder.audit(
                base.id,
                actor,
                "upload",
                "success",
                {
                    "documentId": document.id,
                    "relativePath": normalized_path,
                    "chunks": len(rows),
                    "revision": document.revision,
                },
            )
            response = upload_response(document, len(chunks), parsed.warnings)
            commit_document_version(
                self.db,
                DocumentVersionExpectation(
                    document_id=int(document.id),
                    previous_revision=None,
                    revision=1,
                    chunk_ids=tuple(new_ids),
                ),
            )
        except CommitOutcomeUnknown as exc:
            self.db.rollback()
            raise KnowledgeDocumentProcessingError(str(exc)) from exc
        except Exception as exc:
            cleanup_error: Exception | None = None
            try:
                self.index.delete_ids(base.collection_name, new_ids)
            except Exception as cleanup_exc:
                cleanup_error = cleanup_exc
            self.db.rollback()
            if stored_path is not None:
                try:
                    stored_path.unlink(missing_ok=True)
                except Exception as file_exc:
                    cleanup_error = _combine_errors(cleanup_error, file_exc)
            self.recorder.upload_failure(
                base.id,
                actor,
                "upload",
                normalized_path,
                exc,
                {"newChunkIds": new_ids, "compensationError": safe_error(cleanup_error) if cleanup_error else ""},
            )
            if isinstance(exc, KnowledgeBaseError):
                raise
            if cleanup_error is not None:
                raise KnowledgeDocumentProcessingError(
                    "文档处理失败，且新资源补偿未完整完成；请根据审计日志处理"
                ) from exc
            raise KnowledgeDocumentProcessingError("文档处理失败，请检查解析或向量服务后重试") from exc
        return response

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
        return self.catalog.list(
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

    def split_preview(
        self,
        knowledge_base_id: int,
        document_id: int,
        *,
        chunk_size: int,
        chunk_overlap: int,
        splitter_type: str,
    ) -> dict:
        return self.catalog.split_preview(
            knowledge_base_id,
            document_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            splitter_type=splitter_type,
        )

    def reindex(
        self,
        knowledge_base_id: int,
        document_id: int,
        *,
        chunk_size: int,
        chunk_overlap: int,
        splitter_type: str,
        actor: UserAccount | None = None,
    ) -> dict:
        config = self._config(chunk_size, chunk_overlap, splitter_type)
        base = self._lock_writable_base(knowledge_base_id)
        document = self._lock_scoped_document(knowledge_base_id, document_id)
        if document.index_status == "indexing":
            self.db.rollback()
            raise KnowledgeBaseConflict("文档正在索引，不能重复重新索引")
        if not (document.parsed_content or "").strip():
            self.db.rollback()
            raise KnowledgeDocumentInvalid("该历史文档没有可用于重新索引的解析文本")
        chunks = split_text(document.parsed_content, config)
        if not chunks:
            self.db.rollback()
            raise KnowledgeDocumentInvalid("拆分结果为空，未修改现有索引")
        document.index_status = "indexing"
        document.error_message = ""
        self.db.flush()
        try:
            embeddings = self.index.embed_all(chunks)
            parsed = ParsedDocument(
                text=document.parsed_content,
                parser_name=document.parser_name,
                parser_version=document.parser_version,
                metadata={},
                page_count=None,
                warnings=[],
            )
            result = self._replace_locked_document(
                base,
                document,
                parsed,
                config,
                chunks,
                embeddings,
                actor,
                action="reindex",
            )
            return {
                "id": result["id"],
                "knowledgeBaseId": result["knowledgeBaseId"],
                "revision": result["revision"],
                "chunks": result["chunks"],
                "indexStatus": result["indexStatus"],
                "splitterType": result["splitterType"],
                "chunkSize": result["chunkSize"],
                "chunkOverlap": result["chunkOverlap"],
                "indexedAt": result["indexedAt"],
            }
        except KnowledgeBaseError:
            raise
        except Exception as exc:
            self.db.rollback()
            raise KnowledgeDocumentProcessingError("文档重新索引失败，旧索引已保留") from exc

    def delete(self, knowledge_base_id: int, document_id: int, actor: UserAccount) -> dict:
        result = self.batch_delete(knowledge_base_id, [document_id], actor, action="document_delete")
        return {"id": document_id, "status": "DELETED", "deletedChunks": result["deletedChunks"]}

    def batch_delete(
        self,
        knowledge_base_id: int,
        document_ids: list[int],
        actor: UserAccount,
        *,
        action: str = "batch_document_delete",
    ) -> dict:
        unique_ids = sorted(set(document_ids))
        if not unique_ids or len(unique_ids) > 100 or len(unique_ids) != len(document_ids):
            raise KnowledgeDocumentInvalid("documentIds 必须包含 1 到 100 个不重复的文档 ID")
        base = self._lock_writable_base(knowledge_base_id)
        documents = (
            self.db.query(KnowledgeDocument)
            .options(joinedload(KnowledgeDocument.chunks))
            .filter(
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.id.in_(unique_ids),
                KnowledgeDocument.deleted_at.is_(None),
            )
            .order_by(KnowledgeDocument.id)
            .with_for_update()
            .all()
        )
        if len(documents) != len(unique_ids):
            self.db.rollback()
            raise KnowledgeBaseNotFound("文档不存在")
        if any(document.index_status in {"indexing", "deleting"} for document in documents):
            self.db.rollback()
            raise KnowledgeBaseConflict("所选文档中有正在处理的文档，不能删除")
        self._require_vector_for_destructive_action()

        all_chunks = sorted(
            [chunk for document in documents for chunk in document.chunks],
            key=lambda chunk: int(chunk.id or 0),
        )
        compensation = VectorCompensation([], [])
        quarantined: list[tuple[Path, Path]] = []
        chunk_ids: list[int] = []
        try:
            compensation = self.index.snapshot(base, all_chunks)
            chunk_ids = compensation.chunk_ids
            for document in documents:
                document.index_status = "deleting"
            self.db.flush()
            quarantined = quarantine_document_files(documents, self.settings)
            if self.vector_store.can_embed and chunk_ids:
                self.index.delete_ids(base.collection_name, chunk_ids)
            self.db.query(KnowledgeChunk).filter(KnowledgeChunk.id.in_(chunk_ids)).delete(
                synchronize_session=False
            ) if chunk_ids else None
            self.db.query(KnowledgeDocument).filter(
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.id.in_(unique_ids),
            ).delete(synchronize_session=False)
            self.recorder.audit(
                knowledge_base_id,
                actor,
                action,
                "success",
                {"documentIds": unique_ids, "chunks": len(chunk_ids)},
            )
            commit_document_deletion(self.db, unique_ids)
        except CommitOutcomeUnknown as exc:
            self.db.rollback()
            raise KnowledgeDocumentProcessingError(str(exc)) from exc
        except Exception as exc:
            if isinstance(exc, QuarantineError):
                quarantined = exc.pairs
            self.db.rollback()
            file_errors = restore_files(quarantined)
            if isinstance(exc, QuarantineError):
                file_errors = [*exc.restore_errors, *file_errors]
            compensation_error = self.index.restore(base, compensation)
            if file_errors:
                compensation_error = _combine_errors(
                    compensation_error, RuntimeError("；".join(file_errors))
                )
            self.recorder.delete_failure(knowledge_base_id, unique_ids, actor, action, exc, compensation_error)
            if isinstance(exc, KnowledgeBaseError):
                raise
            message = "文档删除失败，已恢复原文档"
            if compensation_error is not None:
                message = "文档删除失败，且补偿未完整完成；受影响文档已标记为 error"
            raise KnowledgeDocumentProcessingError(message) from exc

        cleanup_warnings = cleanup_quarantine(quarantined)
        if cleanup_warnings:
            logger.warning("document quarantine cleanup failed: %s", cleanup_warnings)
            self.recorder.best_effort_audit(
                knowledge_base_id,
                actor,
                action,
                "cleanup_failed",
                {"documentIds": unique_ids, "warnings": cleanup_warnings},
            )
        return {
            "documentIds": unique_ids,
            "deletedCount": len(unique_ids),
            "deletedChunks": len(chunk_ids),
            "status": "DELETED",
            "warnings": cleanup_warnings,
        }

    def rebuild(self, knowledge_base_id: int, actor: UserAccount | None = None) -> int:
        base = self._lock_writable_base(knowledge_base_id)
        base.status = "indexing"
        self.db.commit()
        chunks = (
            self.db.query(KnowledgeChunk)
            .options(joinedload(KnowledgeChunk.document))
            .filter(KnowledgeChunk.knowledge_base_id == base.id)
            .order_by(KnowledgeChunk.document_id, KnowledgeChunk.source_index)
            .all()
        )
        try:
            embeddings = self.index.embed_all([chunk.content for chunk in chunks])
            self.index.upsert_rows(base, chunks, embeddings)
            if self.vector_store.can_embed:
                self.vector_store.prune_chunks(base.collection_name, chunks)
            self.db.query(KnowledgeDocument).filter(
                KnowledgeDocument.knowledge_base_id == base.id
            ).update(
                {
                    KnowledgeDocument.index_status: "active",
                    KnowledgeDocument.error_message: "",
                    KnowledgeDocument.indexed_at: datetime.utcnow(),
                }
            )
            self.recorder.audit(base.id, actor, "rebuild", "success", {"chunks": len(chunks)})
            updated = self.db.query(KnowledgeBase).filter(
                KnowledgeBase.id == base.id, KnowledgeBase.status == "indexing"
            ).update({KnowledgeBase.status: "active"}, synchronize_session=False)
            if updated != 1:
                raise KnowledgeBaseConflict("知识库状态已变化，不能完成本次重建")
            self.db.commit()
            return len(chunks)
        except Exception as exc:
            self.db.rollback()
            self.db.query(KnowledgeBase).filter(
                KnowledgeBase.id == knowledge_base_id,
                KnowledgeBase.status == "indexing",
            ).update({KnowledgeBase.status: "error"}, synchronize_session=False)
            self.recorder.audit(knowledge_base_id, actor, "rebuild", "error", {"error": safe_error(exc)})
            self.db.commit()
            raise KnowledgeBaseError("知识库重建失败") from exc

    def ensure_source(self, knowledge_base_id: int, source: str, content: str) -> int:
        normalized_path = normalize_relative_path(source, source)
        existing = self.db.query(KnowledgeDocument).filter(
            KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            KnowledgeDocument.relative_path == normalized_path,
            KnowledgeDocument.deleted_at.is_(None),
        ).first()
        content_hash = _content_hash(content.replace("\r\n", "\n").replace("\r", "\n").strip())
        if existing is not None and existing.content_hash == content_hash:
            return self.db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == existing.id).count()
        return int(
            self.ingest_file(
                knowledge_base_id,
                source,
                content.encode("utf-8"),
                replace_existing=True,
                mime_type="text/plain",
            )["chunks"]
        )

    def _replace_locked_document(
        self,
        base: KnowledgeBase,
        document: KnowledgeDocument,
        parsed: ParsedDocument,
        config: SplitterConfig,
        chunks: list[str],
        embeddings: list[list[float]],
        actor: UserAccount | None,
        *,
        action: str,
        temp_path: Path | None = None,
        file_size: int | None = None,
        mime_type: str | None = None,
    ) -> dict:
        old_rows = (
            self.db.query(KnowledgeChunk)
            .options(joinedload(KnowledgeChunk.document))
            .filter(KnowledgeChunk.document_id == document.id)
            .order_by(KnowledgeChunk.source_index)
            .all()
        )
        compensation = VectorCompensation([], [])
        old_storage_path = document.storage_path
        base_id = int(base.id)
        document_id = int(document.id)
        previous_revision = int(document.revision or 0)
        new_storage_path: Path | None = None
        new_ids: list[int] = []
        document.index_status = "indexing"
        document.error_message = ""
        try:
            compensation = self.index.snapshot(base, old_rows)
            rows = self._new_chunk_rows(base.id, document, document.relative_path, chunks)
            self.db.add_all(rows)
            self.db.flush()
            new_ids = [int(row.id) for row in rows if row.id is not None]
            self.index.upsert_rows(base, rows, embeddings)
            if self.vector_store.can_embed and compensation.chunk_ids:
                self.index.delete_ids(base.collection_name, compensation.chunk_ids)
            if compensation.chunk_ids:
                self.db.query(KnowledgeChunk).filter(
                    KnowledgeChunk.id.in_(compensation.chunk_ids)
                ).delete(synchronize_session=False)

            if temp_path is not None:
                new_storage_path = move_upload_to_storage(
                    temp_path, base.id, document.file_name, self.settings
                )
                document.storage_path = str(new_storage_path.relative_to(self.settings.project_root))
            if file_size is not None:
                document.file_size = file_size
            if mime_type is not None:
                document.mime_type = mime_type
            document.parsed_content = parsed.text
            document.content_hash = _content_hash(parsed.text)
            document.parser_name = parsed.parser_name
            document.parser_version = parsed.parser_version
            document.splitter_type = config.splitter_type
            document.chunk_size = config.chunk_size
            document.chunk_overlap = config.chunk_overlap
            document.revision = int(document.revision or 0) + 1
            document.index_status = "active"
            document.error_message = ""
            document.indexed_at = datetime.utcnow()
            self.recorder.audit(
                base.id,
                actor,
                action,
                "success",
                {
                    "documentId": document.id,
                    "oldChunkIds": compensation.chunk_ids,
                    "newChunkIds": new_ids,
                    "revision": document.revision,
                    "splitterType": config.splitter_type,
                    "chunkSize": config.chunk_size,
                    "chunkOverlap": config.chunk_overlap,
                },
            )
            response = {
                **upload_response(document, len(chunks), parsed.warnings),
                "revision": document.revision,
                "indexedAt": document.indexed_at,
            }
            commit_document_version(
                self.db,
                DocumentVersionExpectation(
                    document_id=document_id,
                    previous_revision=previous_revision,
                    revision=int(document.revision),
                    chunk_ids=tuple(new_ids),
                ),
            )
        except CommitOutcomeUnknown as exc:
            self.db.rollback()
            raise KnowledgeDocumentProcessingError(str(exc)) from exc
        except Exception as exc:
            cleanup_error: Exception | None = None
            try:
                self.index.delete_ids(base.collection_name, new_ids)
            except Exception as cleanup_exc:
                cleanup_error = cleanup_exc
            self.db.rollback()
            if new_storage_path is not None:
                try:
                    new_storage_path.unlink(missing_ok=True)
                except Exception as file_exc:
                    cleanup_error = _combine_errors(cleanup_error, file_exc)
            compensation_error = self.index.restore(base, compensation)
            compensation_error = _combine_errors(compensation_error, cleanup_error)
            self.recorder.reindex_failure(base.id, document_id, actor, action, exc, compensation_error)
            if isinstance(exc, KnowledgeBaseError):
                raise
            message = "文档重新索引失败，旧索引已保留"
            if compensation_error is not None:
                message = "文档重新索引失败，且补偿未完整完成；文档已标记为 error"
            raise KnowledgeDocumentProcessingError(message) from exc

        if new_storage_path is not None and old_storage_path:
            try:
                remove_stored_file(old_storage_path, self.settings)
            except Exception as exc:
                logger.exception("failed to remove replaced document file")
                self.recorder.best_effort_audit(
                    base_id,
                    actor,
                    action,
                    "cleanup_failed",
                    {"documentId": document_id, "error": safe_error(exc)},
                )
        return response

    @staticmethod
    def _new_chunk_rows(
        knowledge_base_id: int,
        document: KnowledgeDocument,
        source: str,
        chunks: list[str],
    ) -> list[KnowledgeChunk]:
        return [
            KnowledgeChunk(
                knowledge_base_id=knowledge_base_id,
                document_id=document.id,
                document=document,
                source=source,
                source_index=index,
                content=content,
            )
            for index, content in enumerate(chunks)
        ]

    def _config(
        self, chunk_size: int | None, chunk_overlap: int | None, splitter_type: str
    ) -> SplitterConfig:
        try:
            return validate_splitter_config(
                self.settings.knowledge_chunk_size if chunk_size is None else chunk_size,
                self.settings.knowledge_chunk_overlap if chunk_overlap is None else chunk_overlap,
                splitter_type,
            )
        except SplitterConfigError as exc:
            raise KnowledgeDocumentInvalid(str(exc)) from exc

    def _parse(self, path: Path, name: str) -> ParsedDocument:
        try:
            return parse_document(path, name, self.settings)
        except DocumentParseError as exc:
            raise KnowledgeDocumentInvalid(str(exc) or "文档损坏或无法解析") from exc
        except Exception as exc:
            raise KnowledgeDocumentInvalid("文档损坏或无法解析") from exc

    def _lock_writable_base(self, knowledge_base_id: int) -> KnowledgeBase:
        base = (
            self.db.query(KnowledgeBase)
            .filter(KnowledgeBase.id == knowledge_base_id, KnowledgeBase.deleted_at.is_(None))
            .with_for_update()
            .first()
        )
        if base is None:
            self.db.rollback()
            raise KnowledgeBaseNotFound("知识库不存在")
        self._assert_writable(base)
        return base

    def _lock_scoped_document(self, knowledge_base_id: int, document_id: int) -> KnowledgeDocument:
        document = (
            self.db.query(KnowledgeDocument)
            .filter(
                KnowledgeDocument.id == document_id,
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )
        if document is None:
            self.db.rollback()
            raise KnowledgeBaseNotFound("文档不存在")
        return document

    def _require_vector_for_destructive_action(self) -> None:
        if self.settings.knowledge_vector_enabled and not self.vector_store.can_embed:
            self.db.rollback()
            raise KnowledgeDocumentProcessingError(
                "Chroma 不可用，无法确认向量已安全删除，请恢复向量服务后重试"
            )

    @staticmethod
    def _assert_writable(base: KnowledgeBase) -> None:
        if base.status != "active":
            raise KnowledgeBaseUnavailable("知识库不是 active 状态，不能管理文档")

def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _combine_errors(first: Exception | None, second: Exception | None) -> Exception | None:
    if first is None:
        return second
    if second is None:
        return first
    return RuntimeError(f"{safe_error(first)}；{safe_error(second)}")

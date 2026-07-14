from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import KnowledgeBase, KnowledgeChunk
from app.services.vector_store import (
    ChromaVectorStore,
    VectorRecord,
    VectorStoreUnavailable,
)


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VectorCompensation:
    chunk_ids: list[int]
    records: list[VectorRecord]


class DocumentIndexGateway:
    """Embedding, exact-ID vector writes and compensation for one document."""

    def __init__(
        self, db: Session, settings: Settings, vector_store: ChromaVectorStore
    ) -> None:
        self.db = db
        self.settings = settings
        self.vector_store = vector_store

    def embed_all(self, texts: list[str]) -> list[list[float]]:
        if not self.vector_store.can_embed:
            return []
        embeddings: list[list[float]] = []
        batch_size = max(1, self.settings.knowledge_embedding_batch_size)
        for start in range(0, len(texts), batch_size):
            embeddings.extend(self.vector_store.embed_texts(texts[start : start + batch_size]))
        if len(embeddings) != len(texts):
            raise VectorStoreUnavailable("Embedding response count did not match chunks")
        return embeddings

    def upsert_rows(
        self,
        base: KnowledgeBase,
        rows: list[KnowledgeChunk],
        embeddings: list[list[float]],
    ) -> None:
        if not self.vector_store.can_embed:
            return
        if len(rows) != len(embeddings):
            raise VectorStoreUnavailable("Chunk 与 embedding 数量不一致")
        batch_size = max(1, self.settings.knowledge_embedding_batch_size)
        for start in range(0, len(rows), batch_size):
            batch_rows = rows[start : start + batch_size]
            batch_embeddings = embeddings[start : start + batch_size]
            for row, embedding in zip(batch_rows, batch_embeddings):
                row.embedding_json = json.dumps(embedding, separators=(",", ":"))
            self.vector_store.upsert_chunks(base.collection_name, batch_rows, batch_embeddings)

    def snapshot(
        self, base: KnowledgeBase, rows: list[KnowledgeChunk]
    ) -> VectorCompensation:
        chunk_ids = [int(row.id) for row in rows if row.id is not None]
        if not self.vector_store.can_embed or not rows:
            return VectorCompensation(chunk_ids, [])
        # Snapshot the records that actually exist in Chroma. Regenerating an
        # embedding from the current model would not reproduce the old index if
        # the model or dimensions changed between revisions.
        records = self.vector_store.get_records(base.collection_name, chunk_ids)
        return VectorCompensation(chunk_ids, records)

    def restore(
        self, base: KnowledgeBase, compensation: VectorCompensation
    ) -> Exception | None:
        if not self.vector_store.can_embed or not compensation.records:
            return None
        try:
            self.vector_store.restore_records(base.collection_name, compensation.records)
            return None
        except Exception as exc:
            logger.exception("failed to restore old document vectors")
            self.db.rollback()
            return exc

    def delete_ids(self, collection_name: str, chunk_ids: list[int]) -> None:
        ids = list(chunk_ids)
        if not ids or not self.vector_store.can_embed:
            return
        self.vector_store.delete_ids(collection_name, ids)
        remaining = self.vector_store.get_records(collection_name, ids)
        if remaining:
            raise VectorStoreUnavailable(
                f"Chroma 仍存在 {len(remaining)} 个应删除的 Chunk 向量"
            )

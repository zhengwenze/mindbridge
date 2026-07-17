from __future__ import annotations

import hashlib
import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import httpx

from app.core.config import Settings
from app.models.entities import KnowledgeChunk


PRIMARY_RETRIEVAL_LABEL = "Chroma vector + BM25 hybrid + local reranker"
FALLBACK_RETRIEVAL_LABEL = "local BM25 + hybrid_score reranker"
_VECTOR_OPERATION_BATCH_SIZE = 1000


class VectorStoreUnavailable(RuntimeError):
    pass


@dataclass
class VectorSearchHit:
    chunk_id: int | None
    document_id: int | None
    source: str
    source_index: int
    content: str
    score: float


@dataclass(frozen=True)
class VectorRecord:
    """A complete Chroma record that can be restored during compensation."""

    chunk_id: int
    document: str
    metadata: dict[str, object]
    embedding: list[float]


class EmbeddingService:
    """The only embedding implementation used by every knowledge base."""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def model_name(self) -> str:
        return self.settings.embedding_model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.settings.ai_provider.lower() == "mock":
            return [self._mock_embedding(text) for text in texts]
        response = httpx.post(
            f"{self.settings.ollama_base_url}/api/embed",
            json={"model": self.model_name, "input": [text if text.strip() else " " for text in texts]},
            timeout=self.settings.embedding_timeout_seconds,
        )
        response.raise_for_status()
        embeddings = response.json().get("embeddings", [])
        if len(embeddings) != len(texts) or any(not embedding for embedding in embeddings):
            raise VectorStoreUnavailable("Embedding service returned an invalid vector response")
        return [[float(value) for value in embedding] for embedding in embeddings]

    @staticmethod
    def _mock_embedding(text: str) -> list[float]:
        """Return a deterministic local vector for tests without an Ollama dependency."""
        digest = hashlib.sha256((text if text.strip() else " ").encode("utf-8")).digest()
        return [(value - 127.5) / 127.5 for value in digest]


class ChromaVectorStore:
    """One persistent Chroma client; all collection names originate in MySQL."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.error = ""
        self.can_embed = False
        self.embedding_service = EmbeddingService(settings)
        if not settings.knowledge_vector_enabled:
            self.error = "Chroma 向量库未启用"
            return
        try:
            import chromadb
        except ImportError as exc:
            if settings.knowledge_vector_required:
                raise VectorStoreUnavailable("缺少 chromadb 依赖") from exc
            self.error = "缺少 chromadb 依赖，已回退到本地 BM25"
            return
        self.persist_dir = self._resolve_path(settings.chroma_persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(self.persist_dir))
        self.can_embed = True

    @property
    def embedding_model_name(self) -> str:
        return self.embedding_service.model_name

    def create_collection(self, collection_name: str) -> None:
        self._require_available()
        self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=None,
            metadata={"hnsw:space": "cosine", "embedding_model": self.embedding_model_name},
        )

    def collection_exists(self, collection_name: str) -> bool:
        if not self.can_embed:
            return False
        return any(item.name == collection_name for item in self.client.list_collections())

    def delete_collection(self, collection_name: str) -> None:
        self._require_available()
        if self.collection_exists(collection_name):
            self.client.delete_collection(collection_name)

    def count(self, collection_name: str) -> int:
        self._require_available()
        if not self.collection_exists(collection_name):
            return 0
        return int(self._collection(collection_name).count())

    def upsert_chunks(self, collection_name: str, chunks: list[KnowledgeChunk], embeddings: list[list[float]]) -> int:
        self._require_available()
        rows = [chunk for chunk in chunks if chunk.id is not None and chunk.content.strip()]
        if not rows:
            return 0
        if len(rows) != len(embeddings):
            raise ValueError("Embedding response count did not match chunks")
        collection = self._collection(collection_name)
        collection.upsert(
            ids=[self._id(int(chunk.id)) for chunk in rows],
            documents=[chunk.content for chunk in rows],
            metadatas=[
                {
                    "knowledge_base_id": int(chunk.knowledge_base_id),
                    "document_id": int(chunk.document_id),
                    "chunk_id": int(chunk.id),
                    "file_name": chunk.document.file_name if chunk.document is not None else chunk.source,
                    "chunk_index": int(chunk.source_index),
                    "source": chunk.source,
                }
                for chunk in rows
            ],
            embeddings=embeddings,
        )
        return len(rows)

    def delete_document(self, collection_name: str, document_id: int) -> None:
        self._require_available()
        if self.collection_exists(collection_name):
            self._collection(collection_name).delete(where={"document_id": int(document_id)})

    def get_records(self, collection_name: str, chunk_ids: Iterable[int]) -> list[VectorRecord]:
        """Read complete vector records by database chunk ID without creating a collection."""

        self._require_available()
        normalized_ids = self._normalize_chunk_ids(chunk_ids)
        if not normalized_ids or not self.collection_exists(collection_name):
            return []

        collection = self._collection(collection_name)
        records: list[VectorRecord] = []
        for batch in _batches(normalized_ids, _VECTOR_OPERATION_BATCH_SIZE):
            result = collection.get(
                ids=[self._id(chunk_id) for chunk_id in batch],
                include=["documents", "metadatas", "embeddings"],
            )
            result_ids = result.get("ids") or []
            documents = result.get("documents") or []
            metadatas = result.get("metadatas") or []
            embeddings = result.get("embeddings")
            for index, vector_id in enumerate(result_ids):
                metadata = dict(metadatas[index] or {}) if index < len(metadatas) else {}
                chunk_id = _int_or_none(metadata.get("chunk_id")) or self._chunk_id(str(vector_id))
                embedding = embeddings[index] if embeddings is not None and index < len(embeddings) else None
                if chunk_id is None or embedding is None:
                    raise VectorStoreUnavailable("Chroma 返回的向量记录不完整，无法创建补偿快照")
                records.append(
                    VectorRecord(
                        chunk_id=chunk_id,
                        document=str(documents[index] or "") if index < len(documents) else "",
                        metadata=metadata,
                        embedding=[float(value) for value in embedding],
                    )
                )
        return records

    def delete_ids(self, collection_name: str, chunk_ids: Iterable[int]) -> None:
        """Delete only the requested database chunk IDs; missing collections are a no-op."""

        self._require_available()
        normalized_ids = self._normalize_chunk_ids(chunk_ids)
        if not normalized_ids or not self.collection_exists(collection_name):
            return
        collection = self._collection(collection_name)
        for batch in _batches(normalized_ids, _VECTOR_OPERATION_BATCH_SIZE):
            collection.delete(ids=[self._id(chunk_id) for chunk_id in batch])

    def restore_records(self, collection_name: str, records: Iterable[VectorRecord]) -> int:
        """Restore exact documents, metadata and embeddings into an existing collection."""

        self._require_available()
        unique_records = list({record.chunk_id: record for record in records}.values())
        if not unique_records:
            return 0
        if not self.collection_exists(collection_name):
            raise VectorStoreUnavailable(f"Chroma collection 不存在，无法恢复向量: {collection_name}")

        collection = self._collection(collection_name)
        restored = 0
        for batch in _batches(unique_records, _VECTOR_OPERATION_BATCH_SIZE):
            collection.upsert(
                ids=[self._id(record.chunk_id) for record in batch],
                documents=[record.document for record in batch],
                metadatas=[record.metadata or {"chunk_id": record.chunk_id} for record in batch],
                embeddings=[record.embedding for record in batch],
            )
            restored += len(batch)
        return restored

    def sync_chunks(self, collection_name: str, chunks: list[KnowledgeChunk], embeddings: list[list[float]]) -> int:
        """Update first and prune only after all desired vectors are present."""
        self._require_available()
        indexed = self.upsert_chunks(collection_name, chunks, embeddings)
        collection = self._collection(collection_name)
        desired = {self._id(int(chunk.id)) for chunk in chunks if chunk.id is not None}
        current = set(collection.get().get("ids", []))
        stale = sorted(current - desired)
        if stale:
            collection.delete(ids=stale)
        return indexed

    def prune_chunks(self, collection_name: str, chunks: list[KnowledgeChunk]) -> None:
        """Remove vectors not present in the supplied complete chunk set."""
        self._require_available()
        collection = self._collection(collection_name)
        desired = {self._id(int(chunk.id)) for chunk in chunks if chunk.id is not None}
        current = set(collection.get().get("ids", []))
        stale = sorted(current - desired)
        if stale:
            collection.delete(ids=stale)

    def query(self, collection_name: str, query_embedding: list[float], top_k: int) -> list[VectorSearchHit]:
        self._require_available()
        if not self.collection_exists(collection_name) or self.count(collection_name) == 0:
            return []
        result = self._collection(collection_name).query(
            query_embeddings=[query_embedding], n_results=top_k, include=["documents", "metadatas", "distances"]
        )
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        hits = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            distance = float(distances[index]) if index < len(distances) else 1.0
            hits.append(
                VectorSearchHit(
                    chunk_id=_int_or_none(metadata.get("chunk_id")),
                    document_id=_int_or_none(metadata.get("document_id")),
                    source=str(metadata.get("source", "")),
                    source_index=int(metadata.get("chunk_index", 0)),
                    content=document or "",
                    score=1.0 / (1.0 + max(0.0, distance)),
                )
            )
        return hits

    def snapshot(self) -> str | None:
        if not self.can_embed or not self.persist_dir.exists():
            return None
        snapshot_root = self._resolve_path(self.settings.chroma_snapshot_dir)
        snapshot_root.mkdir(parents=True, exist_ok=True)
        destination = snapshot_root / datetime.utcnow().strftime("%Y%m%d-%H%M%S-%f")
        shutil.copytree(self.persist_dir, destination)
        snapshots = sorted((path for path in snapshot_root.iterdir() if path.is_dir()), reverse=True)
        for stale in snapshots[max(1, self.settings.chroma_snapshot_keep):]:
            shutil.rmtree(stale, ignore_errors=True)
        return str(destination)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        self._require_available()
        return self.embedding_service.embed(texts)

    def _collection(self, collection_name: str):
        # Collection creation is an explicit knowledge-base lifecycle action.
        # Data operations must never recreate a collection that was deleted or
        # whose MySQL ownership record is stale.
        return self.client.get_collection(
            name=collection_name,
            embedding_function=None,
        )

    def _require_available(self) -> None:
        if not self.can_embed:
            raise VectorStoreUnavailable(self.error or "Chroma 向量库不可用")

    def _resolve_path(self, value: str) -> Path:
        path = Path(value)
        return path if path.is_absolute() else self.settings.project_root / path

    @staticmethod
    def _id(chunk_id: int) -> str:
        return f"knowledge-chunk-{chunk_id}"

    @classmethod
    def _chunk_id(cls, vector_id: str) -> int | None:
        prefix = "knowledge-chunk-"
        return _int_or_none(vector_id[len(prefix) :]) if vector_id.startswith(prefix) else None

    @staticmethod
    def _normalize_chunk_ids(chunk_ids: Iterable[int]) -> list[int]:
        normalized: list[int] = []
        seen: set[int] = set()
        for value in chunk_ids:
            chunk_id = int(value)
            if chunk_id <= 0:
                raise ValueError("Chunk ID must be a positive integer")
            if chunk_id not in seen:
                normalized.append(chunk_id)
                seen.add(chunk_id)
        return normalized


def _int_or_none(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _batches[T](values: list[T], size: int) -> Iterable[list[T]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


# Compatibility name for imports outside this module. It no longer owns a
# global collection; callers must always provide the DB-owned collection name.
ChromaKnowledgeStore = ChromaVectorStore
ChromaKnowledgeVectorStore = ChromaVectorStore

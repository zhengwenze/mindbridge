from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.models.entities import KnowledgeDocument
from app.services.knowledge import (
    KnowledgeDocumentInvalid,
    KnowledgeDocumentTooLarge,
    safe_error,
    safe_file_name,
)


logger = logging.getLogger(__name__)
SUPPORTED_SUFFIXES = {".txt", ".md", ".markdown", ".pdf", ".docx"}


class QuarantineError(RuntimeError):
    def __init__(
        self,
        message: str,
        pairs: list[tuple[Path, Path]],
        restore_errors: list[str],
    ) -> None:
        super().__init__(message)
        self.pairs = pairs
        self.restore_errors = restore_errors


def create_upload_temp(settings: Settings, suffix: str = "") -> Path:
    root = settings.project_root / "data" / "knowledge-files" / ".tmp"
    root.mkdir(parents=True, exist_ok=True)
    safe_suffix = suffix.lower() if suffix.lower() in SUPPORTED_SUFFIXES else ""
    return root / f"{uuid.uuid4().hex}{safe_suffix}"


async def receive_upload(file: Any, settings: Settings) -> tuple[Path, int]:
    """Stream a multipart upload to a staging file with a hard byte limit."""
    temp_path = create_upload_temp(settings, Path(file.filename or "").suffix)
    total = 0
    block_size = max(1, settings.knowledge_upload_read_chunk_bytes)
    try:
        with temp_path.open("wb") as target:
            while True:
                block = await file.read(block_size)
                if not block:
                    break
                total += len(block)
                if total > settings.knowledge_upload_max_bytes:
                    raise KnowledgeDocumentTooLarge("单个文件超过允许的上传大小")
                target.write(block)
        return temp_path, total
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def move_upload_to_storage(
    temp_path: Path, knowledge_base_id: int, name: str, settings: Settings
) -> Path:
    root = settings.project_root / "data" / "knowledge-files" / str(knowledge_base_id)
    root.mkdir(parents=True, exist_ok=True)
    destination = root / f"{uuid.uuid4().hex}_{safe_file_name(name)}"
    return Path(shutil.move(str(temp_path), destination))


def resolve_stored_file(value: str | None, settings: Settings) -> Path | None:
    if not value:
        return None
    root = (settings.project_root / "data" / "knowledge-files").resolve()
    path = (settings.project_root / value).resolve()
    if not path.is_relative_to(root):
        raise KnowledgeDocumentInvalid("文档存储路径越界")
    return path


def remove_stored_file(value: str | None, settings: Settings) -> None:
    path = resolve_stored_file(value, settings)
    if path is not None and path.is_file():
        path.unlink()


def quarantine_document_files(
    documents: list[KnowledgeDocument], settings: Settings
) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    try:
        for document in documents:
            original = resolve_stored_file(document.storage_path, settings)
            if original is None or not original.exists():
                continue
            quarantine = original.with_name(f".{original.name}.{uuid.uuid4().hex}.deleting")
            original.replace(quarantine)
            pairs.append((original, quarantine))
        return pairs
    except Exception:
        restore_errors = restore_files(pairs)
        raise QuarantineError(
            "原文件移入删除隔离区失败", pairs, restore_errors
        )


def restore_files(pairs: list[tuple[Path, Path]]) -> list[str]:
    errors: list[str] = []
    for original, quarantine in reversed(pairs):
        try:
            if quarantine.exists() and not original.exists():
                quarantine.replace(original)
        except Exception as exc:
            errors.append(f"{original.name}: {safe_error(exc)}")
            logger.exception("failed to restore quarantined document file %s", original)
    return errors


def cleanup_quarantine(pairs: list[tuple[Path, Path]]) -> list[str]:
    warnings: list[str] = []
    for _, quarantine in pairs:
        try:
            quarantine.unlink(missing_ok=True)
        except Exception as exc:
            warnings.append(f"{quarantine.name}: {safe_error(exc)}")
    return warnings

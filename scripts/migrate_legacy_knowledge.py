"""Adopt an existing pre-Alembic MySQL database without silently losing RAG data."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.core.database import SessionLocal, engine


BASELINE_REVISION = "20260713_0001"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adopt-legacy", action="store_true", help="Required acknowledgement for a database without alembic_version")
    args = parser.parse_args()
    settings = get_settings()
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "knowledge_chunks" not in tables:
        raise RuntimeError("未发现旧 knowledge_chunks 表；新环境请直接执行 alembic upgrade head")
    if "alembic_version" in tables:
        raise RuntimeError("数据库已由 Alembic 管理；请直接执行 alembic upgrade head")
    if not args.adopt_legacy:
        raise RuntimeError("此操作会为既有数据库写入 Alembic baseline。确认备份后使用 --adopt-legacy")

    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    backup_root = settings.project_root / "data" / "legacy-knowledge-backups" / timestamp
    backup_root.mkdir(parents=True, exist_ok=False)
    with SessionLocal() as db:
        rows = db.execute(text("SELECT id, source, source_index, content, embedding_json, created_at FROM knowledge_chunks ORDER BY id")).mappings().all()
    (backup_root / "knowledge_chunks.json").write_text(json.dumps([dict(row) | {"created_at": str(row["created_at"])} for row in rows], ensure_ascii=False, indent=2), encoding="utf-8")
    chroma = Path(settings.chroma_persist_dir)
    chroma = chroma if chroma.is_absolute() else settings.project_root / chroma
    if chroma.exists():
        shutil.copytree(chroma, backup_root / "chroma")

    config = Config(str(settings.project_root / "alembic.ini"))
    command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")
    print(json.dumps({"backup": str(backup_root), "legacyChunkCount": len(rows), "oldCollectionRetained": True}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

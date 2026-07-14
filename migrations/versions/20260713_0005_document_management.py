"""Persist parsed documents and per-document splitting configuration."""

from __future__ import annotations

import hashlib

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = "20260713_0005"
down_revision = "20260713_0004"
branch_labels = None
depends_on = None

DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 64
EMPTY_CONTENT_HASH = hashlib.sha256(b"").hexdigest()


def upgrade() -> None:
    # Add nullable columns first so historical rows and rolling application
    # instances remain writable while their parsed content is being rebuilt.
    op.add_column("knowledge_documents", sa.Column("parsed_content", mysql.LONGTEXT(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("content_hash", sa.CHAR(64), nullable=True))
    op.add_column("knowledge_documents", sa.Column("parser_name", sa.String(64), nullable=True))
    op.add_column("knowledge_documents", sa.Column("parser_version", sa.String(32), nullable=True))
    op.add_column("knowledge_documents", sa.Column("splitter_type", sa.String(64), nullable=True))
    op.add_column("knowledge_documents", sa.Column("chunk_size", sa.Integer(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("chunk_overlap", sa.Integer(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("revision", sa.Integer(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("indexed_at", sa.DateTime(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("mime_type", sa.String(255), nullable=True))

    bind = op.get_bind()
    documents = bind.execute(
        sa.text("SELECT id, index_status, updated_at FROM knowledge_documents ORDER BY id")
    ).mappings().all()
    for document in documents:
        # Rebuild one document at a time rather than GROUP_CONCAT, whose server
        # length limit can silently truncate large historical documents.
        contents = bind.execute(
            sa.text(
                "SELECT content FROM knowledge_chunks "
                "WHERE document_id = :document_id ORDER BY source_index, id"
            ),
            {"document_id": int(document["id"])},
        ).scalars().all()
        parsed_content = "\n\n".join(str(content or "") for content in contents)
        content_hash = hashlib.sha256(parsed_content.encode("utf-8")).hexdigest()
        indexed_at = document["updated_at"] if document["index_status"] == "active" else None
        bind.execute(
            sa.text(
                "UPDATE knowledge_documents SET "
                "parsed_content = :parsed_content, content_hash = :content_hash, "
                "parser_name = 'legacy_chunks', parser_version = '1', "
                "splitter_type = 'recursive_character', chunk_size = :chunk_size, "
                "chunk_overlap = :chunk_overlap, revision = 1, indexed_at = :indexed_at "
                "WHERE id = :document_id"
            ),
            {
                "document_id": int(document["id"]),
                "parsed_content": parsed_content,
                "content_hash": content_hash,
                "chunk_size": DEFAULT_CHUNK_SIZE,
                "chunk_overlap": DEFAULT_CHUNK_OVERLAP,
                "indexed_at": indexed_at,
            },
        )

    # Text defaults require an expression on MySQL 8.0; keeping defaults here
    # also allows an older application process to insert during a rolling
    # deployment without violating the new NOT NULL constraints.
    op.alter_column(
        "knowledge_documents",
        "parsed_content",
        existing_type=mysql.LONGTEXT(),
        nullable=False,
        server_default=sa.text("('')"),
    )
    op.alter_column(
        "knowledge_documents",
        "content_hash",
        existing_type=sa.CHAR(64),
        nullable=False,
        server_default=EMPTY_CONTENT_HASH,
    )
    op.alter_column(
        "knowledge_documents",
        "parser_name",
        existing_type=sa.String(64),
        nullable=False,
        server_default="legacy_chunks",
    )
    op.alter_column(
        "knowledge_documents",
        "parser_version",
        existing_type=sa.String(32),
        nullable=False,
        server_default="1",
    )
    op.alter_column(
        "knowledge_documents",
        "splitter_type",
        existing_type=sa.String(64),
        nullable=False,
        server_default="recursive_character",
    )
    op.alter_column(
        "knowledge_documents",
        "chunk_size",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=str(DEFAULT_CHUNK_SIZE),
    )
    op.alter_column(
        "knowledge_documents",
        "chunk_overlap",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=str(DEFAULT_CHUNK_OVERLAP),
    )
    op.alter_column(
        "knowledge_documents",
        "revision",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="1",
    )


def downgrade() -> None:
    op.drop_column("knowledge_documents", "mime_type")
    op.drop_column("knowledge_documents", "indexed_at")
    op.drop_column("knowledge_documents", "revision")
    op.drop_column("knowledge_documents", "chunk_overlap")
    op.drop_column("knowledge_documents", "chunk_size")
    op.drop_column("knowledge_documents", "splitter_type")
    op.drop_column("knowledge_documents", "parser_version")
    op.drop_column("knowledge_documents", "parser_name")
    op.drop_column("knowledge_documents", "content_hash")
    op.drop_column("knowledge_documents", "parsed_content")

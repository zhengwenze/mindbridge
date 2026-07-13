"""Store document relative paths for folder uploads."""

from alembic import op
import sqlalchemy as sa


revision = "20260713_0004"
down_revision = "20260713_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("knowledge_documents", sa.Column("relative_path", sa.String(512), nullable=True))
    op.execute("UPDATE knowledge_documents SET relative_path = file_name WHERE relative_path IS NULL")
    op.alter_column(
        "knowledge_documents",
        "relative_path",
        existing_type=sa.String(512),
        nullable=False,
    )
    op.drop_constraint("uq_knowledge_document_file", "knowledge_documents", type_="unique")
    op.create_unique_constraint(
        "uq_knowledge_document_path",
        "knowledge_documents",
        ["knowledge_base_id", "relative_path"],
    )
    op.alter_column(
        "knowledge_chunks",
        "source",
        existing_type=sa.String(256),
        type_=sa.String(512),
        existing_nullable=False,
    )


def downgrade() -> None:
    # A folder upload may contain equal basenames. Keep the downgrade explicit
    # and fail safely instead of silently deleting user documents.
    op.create_unique_constraint(
        "uq_knowledge_document_file",
        "knowledge_documents",
        ["knowledge_base_id", "file_name"],
    )
    op.drop_constraint("uq_knowledge_document_path", "knowledge_documents", type_="unique")
    op.alter_column(
        "knowledge_chunks",
        "source",
        existing_type=sa.String(512),
        type_=sa.String(256),
        existing_nullable=False,
    )
    op.drop_column("knowledge_documents", "relative_path")

"""Create the pre-existing MindBridge schema for fresh MySQL databases."""

from alembic import op
import sqlalchemy as sa

from app.core.database import Base
from app.models import entities  # noqa: F401


revision = "20260713_0001"
down_revision = None
branch_labels = None
depends_on = None

# These knowledge-domain tables belong to later historical revisions. Keep
# them out of the dynamic legacy metadata pass so a fresh database does not
# create foreign keys to knowledge_bases before revision 0002 creates it.
NEW_TABLES = {
    "knowledge_bases",
    "knowledge_documents",
    "knowledge_base_operation_logs",
    "knowledge_base_references",
}


def upgrade() -> None:
    bind = op.get_bind()
    # KnowledgeChunk changed in the following migration. Create its historical
    # shape explicitly so a fresh database can execute both revisions.
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(length=256), nullable=False),
        sa.Column("source_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_knowledge_chunks_source", "knowledge_chunks", ["source"])
    for table in Base.metadata.sorted_tables:
        if table.name in NEW_TABLES or table.name == "knowledge_chunks":
            continue
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        if table.name not in NEW_TABLES:
            table.drop(bind=bind, checkfirst=True)

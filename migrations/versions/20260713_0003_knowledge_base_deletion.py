"""Add explicit knowledge-base reference registry for safe deletion."""

from alembic import op
import sqlalchemy as sa


revision = "20260713_0003"
down_revision = "20260713_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_base_references",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("knowledge_base_id", sa.Integer(), sa.ForeignKey("knowledge_bases.id"), nullable=False),
        sa.Column("reference_type", sa.String(32), nullable=False),
        sa.Column("reference_id", sa.String(128), nullable=False),
        sa.Column("reference_name", sa.String(256), nullable=False, server_default=""),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("blocking", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("knowledge_base_id", "reference_type", "reference_id", name="uq_knowledge_base_reference"),
    )
    op.create_index("ix_knowledge_base_references_knowledge_base_id", "knowledge_base_references", ["knowledge_base_id"])
    op.create_index("ix_knowledge_base_references_reference_type", "knowledge_base_references", ["reference_type"])
    op.create_index("ix_knowledge_base_references_status", "knowledge_base_references", ["status"])
    op.create_index("ix_knowledge_base_references_blocking", "knowledge_base_references", ["blocking"])


def downgrade() -> None:
    op.drop_table("knowledge_base_references")

"""Add isolated knowledge bases, documents, chunks ownership and legacy backfill."""

from alembic import op
import sqlalchemy as sa


revision = "20260713_0002"
down_revision = "20260713_0001"
branch_labels = None
depends_on = None

DEFAULT_BASES = (
    ("心理健康基础知识库", "存储大学生常见心理健康问题、情绪调节、压力管理、人际关系与心理健康科普资料。"),
    ("校园心理咨询政策库", "存储学校心理咨询预约流程、服务制度、咨询须知、保密原则与校内心理服务信息。"),
    ("危机干预知识库", "存储心理危机识别、风险分级、危机干预流程、紧急转介与人工介入规范。"),
)


def upgrade() -> None:
    op.create_table(
        "knowledge_bases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("collection_name", sa.String(128), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("user_accounts.id"), nullable=True),
        sa.Column("active_name", sa.String(128), sa.Computed("IF(deleted_at IS NULL, name, NULL)"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("active_name", name="uq_knowledge_bases_active_name"),
        sa.UniqueConstraint("collection_name", name="uq_knowledge_bases_collection_name"),
    )
    op.create_index("ix_knowledge_bases_status", "knowledge_bases", ["status"])
    op.create_index("ix_knowledge_bases_created_by", "knowledge_bases", ["created_by"])
    op.create_index("ix_knowledge_bases_deleted_at", "knowledge_bases", ["deleted_at"])
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("knowledge_base_id", sa.Integer(), sa.ForeignKey("knowledge_bases.id"), nullable=False),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("file_type", sa.String(32), nullable=False, server_default="text"),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("storage_path", sa.String(512), nullable=True),
        sa.Column("index_status", sa.String(32), nullable=False, server_default="indexing"),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("knowledge_base_id", "file_name", name="uq_knowledge_document_file"),
    )
    op.create_index("ix_knowledge_documents_knowledge_base_id", "knowledge_documents", ["knowledge_base_id"])
    op.create_index("ix_knowledge_documents_index_status", "knowledge_documents", ["index_status"])
    op.create_index("ix_knowledge_documents_deleted_at", "knowledge_documents", ["deleted_at"])
    op.add_column("knowledge_chunks", sa.Column("knowledge_base_id", sa.Integer(), nullable=True))
    op.add_column("knowledge_chunks", sa.Column("document_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_chunks_kb", "knowledge_chunks", "knowledge_bases", ["knowledge_base_id"], ["id"])
    op.create_foreign_key("fk_chunks_document", "knowledge_chunks", "knowledge_documents", ["document_id"], ["id"])
    op.create_index("ix_knowledge_chunks_knowledge_base_id", "knowledge_chunks", ["knowledge_base_id"])
    op.create_index("ix_knowledge_chunks_document_id", "knowledge_chunks", ["document_id"])
    op.create_index("ix_knowledge_chunks_kb_document", "knowledge_chunks", ["knowledge_base_id", "document_id"])
    op.create_table(
        "knowledge_base_operation_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("knowledge_base_id", sa.Integer(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("detail_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_knowledge_base_operation_logs_knowledge_base_id", "knowledge_base_operation_logs", ["knowledge_base_id"])
    op.create_index("ix_knowledge_base_operation_logs_actor_id", "knowledge_base_operation_logs", ["actor_id"])
    op.create_index("ix_knowledge_base_operation_logs_action", "knowledge_base_operation_logs", ["action"])
    op.create_index("ix_knowledge_base_operation_logs_status", "knowledge_base_operation_logs", ["status"])

    bind = op.get_bind()
    admin_id = bind.execute(sa.text("SELECT id FROM user_accounts WHERE roles_csv LIKE '%ROLE_ADMIN%' ORDER BY id LIMIT 1")).scalar()
    base_ids: dict[str, int] = {}
    for name, description in DEFAULT_BASES:
        result = bind.execute(
            sa.text("INSERT INTO knowledge_bases (name, description, collection_name, status, created_by, created_at, updated_at) VALUES (:name, :description, :collection, 'active', :created_by, UTC_TIMESTAMP(), UTC_TIMESTAMP())"),
            {"name": name, "description": description, "collection": f"pending-{name}", "created_by": admin_id},
        )
        base_id = int(result.lastrowid)
        bind.execute(sa.text("UPDATE knowledge_bases SET collection_name=:collection WHERE id=:id"), {"collection": f"mindbridge_kb_{base_id}", "id": base_id})
        base_ids[name] = base_id

    base_id = base_ids["心理健康基础知识库"]
    sources = bind.execute(sa.text("SELECT source, COUNT(*) AS count FROM knowledge_chunks GROUP BY source")).mappings().all()
    for index, row in enumerate(sources):
        source = str(row["source"] or f"legacy-{index}")[:256]
        result = bind.execute(
            sa.text("INSERT INTO knowledge_documents (knowledge_base_id, file_name, file_type, file_size, index_status, error_message, created_at, updated_at) VALUES (:kb, :name, :file_type, 0, 'pending', '', UTC_TIMESTAMP(), UTC_TIMESTAMP())"),
            {"kb": base_id, "name": source, "file_type": source.rsplit(".", 1)[-1].lower() if "." in source else "text"},
        )
        document_id = int(result.lastrowid)
        bind.execute(sa.text("UPDATE knowledge_chunks SET knowledge_base_id=:kb, document_id=:document WHERE source=:source"), {"kb": base_id, "document": document_id, "source": row["source"]})
    op.alter_column("knowledge_chunks", "knowledge_base_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("knowledge_chunks", "document_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.drop_constraint("fk_chunks_document", "knowledge_chunks", type_="foreignkey")
    op.drop_constraint("fk_chunks_kb", "knowledge_chunks", type_="foreignkey")
    op.drop_index("ix_knowledge_chunks_kb_document", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_document_id", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_knowledge_base_id", table_name="knowledge_chunks")
    op.drop_column("knowledge_chunks", "document_id")
    op.drop_column("knowledge_chunks", "knowledge_base_id")
    op.drop_table("knowledge_base_operation_logs")
    op.drop_table("knowledge_documents")
    op.drop_table("knowledge_bases")

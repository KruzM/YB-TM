"""manual + client links + quick notes + intercompany tasks

Revision ID: b7c1a4f1d2e3
Revises: f430e046c21e
Create Date: 2025-12-29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b7c1a4f1d2e3"
down_revision: Union[str, Sequence[str], None] = "f430e046c21e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_client_links",
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), primary_key=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(DATETIME('now'))")),
    )

    op.create_table(
        "client_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("related_client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("relationship_type", sa.String(), nullable=False, server_default="intercompany"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(DATETIME('now'))")),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.UniqueConstraint("client_id", "related_client_id", "relationship_type", name="uq_client_links"),
    )

    op.create_table(
        "client_manual_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=True, index=True),
        sa.Column("category", sa.String(), nullable=False, server_default="general"),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(DATETIME('now'))")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("(DATETIME('now'))")),
    )

    op.create_table(
        "quick_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=True, index=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("(DATETIME('now'))")),
    )
    # add tasks.is_intercompany
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("is_intercompany", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    # add recurring_template_tasks.tier
    with op.batch_alter_table("recurring_template_tasks") as batch_op:
        batch_op.add_column(sa.Column("tier", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("recurring_template_tasks") as batch_op:
        batch_op.drop_column("tier")

    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("is_intercompany")

    op.drop_table("quick_notes")
    op.drop_table("client_manual_entries")
    op.drop_table("client_links")
    op.drop_table("task_client_links")
"""add onboarding template tasks

Revision ID: f41524bf0bcb
Revises: cfaf467c43f2
Create Date: 2025-12-09 13:43:06.940416
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f41524bf0bcb"
down_revision: Union[str, Sequence[str], None] = "cfaf467c43f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create onboarding_template_tasks table."""
    op.create_table(
        "onboarding_template_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("phase", sa.String(), nullable=True),
        sa.Column("default_due_offset_days", sa.Integer(), nullable=True),
        sa.Column("default_assigned_role", sa.String(), nullable=True),
        sa.Column(
            "order_index",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.create_index(
        "ix_onboarding_template_tasks_id",
        "onboarding_template_tasks",
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema: drop onboarding_template_tasks table."""
    op.drop_index(
        "ix_onboarding_template_tasks_id",
        table_name="onboarding_template_tasks",
    )
    op.drop_table("onboarding_template_tasks")

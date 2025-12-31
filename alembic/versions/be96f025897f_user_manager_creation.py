"""user/manager creation

Revision ID: be96f025897f
Revises: b7c1a4f1d2e3
Create Date: 2025-12-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c91d0e1a2b3c"
down_revision: Union[str, Sequence[str], None] = "b7c1a4f1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("manager_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_users_manager_id_users",
            "users",
            ["manager_id"],
            ["id"],
        )
        batch_op.create_index("ix_users_manager_id", ["manager_id"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_manager_id")
        batch_op.drop_constraint("fk_users_manager_id_users", type_="foreignkey")
        batch_op.drop_column("manager_id")
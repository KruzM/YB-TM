"""Manager / Bookkeeper roles

Revision ID: 670360214412
Revises: f41524bf0bcb
Create Date: 2025-12-15
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "670360214412"
down_revision = "f41524bf0bcb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("client_intake", schema=None) as batch_op:
        batch_op.add_column(sa.Column("manager_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("bookkeeper_id", sa.Integer(), nullable=True))

        batch_op.create_foreign_key(
            "fk_client_intake_manager_id_users",
            "users",
            ["manager_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_client_intake_bookkeeper_id_users",
            "users",
            ["bookkeeper_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("client_intake", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_client_intake_bookkeeper_id_users",
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            "fk_client_intake_manager_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("bookkeeper_id")
        batch_op.drop_column("manager_id")

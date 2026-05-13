"""Índice para consultas por asignado (dashboard)."""

from __future__ import annotations

from alembic import op

revision = "002_ix_task_users_user_id"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_task_users_user_id",
        "task_users",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_task_users_user_id", table_name="task_users")

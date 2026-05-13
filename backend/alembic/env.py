"""Alembic migration environment (sync engine, `DATABASE_URL` requerida)."""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.db.base import Base

# isort: off — orden explícito para registrar mappers antes de `target_metadata`.
import app.models.user  # noqa: F401
import app.models.project  # noqa: F401
import app.models.task  # noqa: F401
import app.models.notification  # noqa: F401

# isort: on

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        msg = "DATABASE_URL debe estar definida para ejecutar migraciones."
        raise RuntimeError(msg)
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(get_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

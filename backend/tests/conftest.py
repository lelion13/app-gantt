"""Pytest: Postgres + Alembic (DATABASE_URL), limpieza entre tests."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def pytest_configure(config: pytest.Config) -> None:
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql+psycopg://app_gantt:app_gantt@127.0.0.1:5432/app_gantt_test"
        "?sslmode=disable",
    )
    os.environ.setdefault(
        "JWT_SECRET",
        "test_jwt_secret_at_least_32_characters_long_xx",
    )
    os.environ["BOOTSTRAP_ADMIN_EMAIL"] = ""
    os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = ""
    os.environ["DISABLE_LOGIN_RATE_LIMIT"] = "1"

    import app.db.session as session_mod
    from app.core.config import get_settings

    session_mod._engine = None
    session_mod._session_factory = None
    get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def _alembic_upgrade() -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_ROOT,
        env={**os.environ},
        check=True,
    )
    yield


@pytest.fixture(autouse=True)
def _clean_db_and_limits() -> None:
    from app.db.session import get_engine
    from app.services.login_rate_limit import reset_login_rate_limits

    reset_login_rate_limits()
    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE notification_outbox, task_updates, task_users, tasks, "
                "project_users, projects, users RESTART IDENTITY CASCADE",
            ),
        )
    yield
    reset_login_rate_limits()


@pytest.fixture
def db_session():
    from app.db.session import get_engine
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client():
    from app.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c

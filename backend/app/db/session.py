"""Motor y fábrica de sesiones (sync), inicialización perezosa desde Settings."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _ensure_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        from app.core.config import get_settings

        _engine = create_engine(
            get_settings().database_url,
            pool_pre_ping=True,
        )
        _session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=_engine,
        )
    return _engine


def get_engine() -> Engine:
    """Expuesto para healthchecks o scripts."""
    return _ensure_engine()


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: una sesión por request."""
    _ensure_engine()
    assert _session_factory is not None
    db = _session_factory()
    try:
        yield db
    finally:
        db.close()

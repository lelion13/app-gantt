"""Health / readiness."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router_root = APIRouter(tags=["health"])

router_v1 = APIRouter(tags=["health"])


def _database_ping(db: Session) -> str:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return "unreachable"
    return "ok"


@router_root.get("/health")
def health_root() -> dict[str, str]:
    """Liveness mínimo (sin DB)."""
    return {"status": "ok"}


@router_root.get("/health/full")
def health_full(
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Estado con ping a la base (200 aunque la DB falle)."""
    return {"status": "ok", "database": _database_ping(db)}


@router_v1.get("/health")
def health_api_v1(
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Misma semántica que `/health/full` bajo el prefijo de API (Dockerfile)."""
    return {"status": "ok", "database": _database_ping(db)}

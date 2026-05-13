"""Recursos bajo `/me` (dashboard del usuario autenticado)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardTaskView, TaskDashboardItem
from app.services import dashboard as dashboard_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/tasks", response_model=list[TaskDashboardItem])
def list_my_dashboard_tasks(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    view: Annotated[
        DashboardTaskView,
        Query(
            description="mine: asignadas; in_progress: asignadas en progreso; "
            "overdue: asignadas con end_date anterior a hoy (zona APP_TIMEZONE)",
        ),
    ] = DashboardTaskView.mine,
) -> list[TaskDashboardItem]:
    rows = dashboard_service.list_dashboard_tasks(db, user, view=view)
    return [
        TaskDashboardItem(
            id=t.id,
            project_id=t.project_id,
            project_title=title,
            title=t.title,
            description=t.description,
            start_date=t.start_date,
            end_date=t.end_date,
            status=t.status,
            deleted_at=t.deleted_at,
        )
        for t, title in rows
    ]

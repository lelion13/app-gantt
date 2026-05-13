"""Listados de tareas para el dashboard (asignaciones del usuario)."""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import LifecycleStatus
from app.models.project import Project
from app.models.task import Task, TaskUser
from app.models.user import User
from app.schemas.dashboard import DashboardTaskView


def _today_in_app_tz() -> date:
    tz_name = get_settings().app_timezone
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except (ZoneInfoNotFoundError, OSError):
        return datetime.now(ZoneInfo("UTC")).date()


def list_dashboard_tasks(
    db: Session,
    user: User,
    *,
    view: DashboardTaskView,
) -> list[tuple[Task, str]]:
    today = _today_in_app_tz()
    stmt = (
        select(Task, Project.title)
        .join(Project, Project.id == Task.project_id)
        .join(TaskUser, TaskUser.task_id == Task.id)
        .where(
            TaskUser.user_id == user.id,
            Task.deleted_at.is_(None),
            Project.deleted_at.is_(None),
        )
    )
    if view == DashboardTaskView.in_progress:
        stmt = stmt.where(Task.status == LifecycleStatus.in_progress)
    elif view == DashboardTaskView.overdue:
        stmt = stmt.where(Task.end_date < today)
    stmt = stmt.order_by(Project.title, Task.title)
    rows = list(db.execute(stmt).all())
    return [(t, title) for t, title in rows]

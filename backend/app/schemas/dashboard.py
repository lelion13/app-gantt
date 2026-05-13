"""Respuestas del dashboard (listados de tareas)."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import LifecycleStatus


class DashboardTaskView(StrEnum):
    mine = "mine"
    in_progress = "in_progress"
    overdue = "overdue"


class TaskDashboardItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    project_title: str
    title: str
    description: str | None
    start_date: date
    end_date: date
    status: LifecycleStatus
    deleted_at: datetime | None

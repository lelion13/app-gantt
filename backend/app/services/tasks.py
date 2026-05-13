"""Tareas y asignaciones bajo proyecto."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.enums import OutboxStatus
from app.models.notification import NotificationOutbox
from app.models.project import Project
from app.models.task import Task, TaskUser
from app.models.user import User
from app.schemas.task import TaskAssigneeAdd, TaskCreate, TaskUpdate
from app.services.projects import assert_project_pm, user_is_project_member


def _task_with_assignees(db: Session, task_id: UUID) -> Task | None:
    return db.scalar(
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.assignees).selectinload(TaskUser.user)),
    )


def _merged_task_dates(target: Task, data: dict) -> tuple[date, date]:
    start = data.get("start_date", target.start_date)
    end = data.get("end_date", target.end_date)
    return start, end


def list_tasks_for_project(db: Session, *, project: Project) -> list[Task]:
    stmt = (
        select(Task)
        .where(
            Task.project_id == project.id,
            Task.deleted_at.is_(None),
        )
        .order_by(Task.title)
    )
    return list(db.scalars(stmt).all())


def get_task_in_project(
    db: Session,
    *,
    project_id: UUID,
    task_id: UUID,
) -> Task | None:
    t = db.scalar(
        select(Task)
        .where(
            Task.id == task_id,
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
        .options(selectinload(Task.assignees).selectinload(TaskUser.user)),
    )
    return t


def _is_project_pm(project: Project, actor: User) -> bool:
    return project.project_manager_id == actor.id


def create_task(
    db: Session,
    *,
    project: Project,
    actor: User,
    body: TaskCreate,
) -> Task:
    assert_project_pm(project, actor)
    desc: str | None = None
    if body.description is not None:
        s = body.description.strip()
        desc = s if s else None
    task = Task(
        project_id=project.id,
        title=body.title.strip(),
        description=desc,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
    )
    db.add(task)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo crear la tarea",
        ) from None
    out = _task_with_assignees(db, task.id)
    assert out is not None
    return out


def update_task(
    db: Session,
    *,
    project: Project,
    actor: User,
    task: Task,
    body: TaskUpdate,
) -> Task:
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios",
        )
    is_pm = _is_project_pm(project, actor)
    if not is_pm:
        row = db.get(TaskUser, (task.id, actor.id))
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prohibido",
            )
        allowed = {"status", "start_date", "end_date"}
        if not set(data).issubset(allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prohibido",
            )

    start, end = _merged_task_dates(task, data)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date debe ser mayor o igual que start_date",
        )

    if "title" in data:
        task.title = data["title"].strip()
    if "description" in data:
        raw = data["description"]
        task.description = raw.strip() if isinstance(raw, str) and raw.strip() else None
    if "start_date" in data:
        task.start_date = data["start_date"]
    if "end_date" in data:
        task.end_date = data["end_date"]
    if "status" in data:
        task.status = data["status"]
    if "is_active" in data:
        if not is_pm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prohibido",
            )
        task.deleted_at = None if data["is_active"] else datetime.now(UTC)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar la tarea",
        ) from None
    out = _task_with_assignees(db, task.id)
    assert out is not None
    return out


def soft_delete_task(db: Session, *, project: Project, actor: User, task: Task) -> None:
    assert_project_pm(project, actor)
    if task.deleted_at is not None:
        return
    task.deleted_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo eliminar la tarea",
        ) from None


def add_assignee(
    db: Session,
    *,
    project: Project,
    actor: User,
    task: Task,
    body: TaskAssigneeAdd,
) -> Task:
    assert_project_pm(project, actor)
    if not user_is_project_member(db, project.id, body.user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no es miembro del proyecto",
        )
    assignee = db.get(User, body.user_id)
    if assignee is None or assignee.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inválido o inactivo",
        )
    existing = db.get(TaskUser, (task.id, body.user_id))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario ya está asignado a la tarea",
        )
    db.add(TaskUser(task_id=task.id, user_id=body.user_id))
    db.add(
        NotificationOutbox(
            event_type="task_assigned",
            payload={
                "task_id": str(task.id),
                "project_id": str(project.id),
                "assignee_user_id": str(body.user_id),
            },
            status=OutboxStatus.pending,
        ),
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo asignar el usuario",
        ) from None
    out = _task_with_assignees(db, task.id)
    assert out is not None
    return out


def remove_assignee(
    db: Session,
    *,
    project: Project,
    actor: User,
    task: Task,
    assignee_user_id: UUID,
) -> Task:
    assert_project_pm(project, actor)
    row = db.get(TaskUser, (task.id, assignee_user_id))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada",
        )
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo quitar la asignación",
        ) from None
    out = _task_with_assignees(db, task.id)
    assert out is not None
    return out

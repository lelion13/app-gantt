"""Bitácora de avance por tarea (task_updates)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.project import Project
from app.models.task import Task, TaskUpdate, TaskUser
from app.models.user import User
from app.schemas.task_update import TaskUpdateCreate
from app.services.projects import user_is_project_member


def _task_and_project(db: Session, task_id: UUID) -> tuple[Task, Project] | None:
    task = db.get(Task, task_id)
    if task is None:
        return None
    project = db.get(Project, task.project_id)
    if project is None:
        return None
    return task, project


def assert_member_for_task(
    db: Session,
    user: User,
    task: Task,
    project: Project,
) -> None:
    if project.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    if not user_is_project_member(db, project.id, user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )


def assert_can_create_update(
    db: Session,
    user: User,
    task: Task,
    project: Project,
) -> None:
    assert_member_for_task(db, user, task, project)
    if task.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    if project.project_manager_id == user.id:
        return
    if db.get(TaskUser, (task.id, user.id)) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Prohibido",
        )


def list_task_updates(
    db: Session,
    *,
    user: User,
    task_id: UUID,
) -> list[TaskUpdate]:
    pair = _task_and_project(db, task_id)
    if pair is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    task, project = pair
    assert_member_for_task(db, user, task, project)
    stmt = (
        select(TaskUpdate)
        .where(TaskUpdate.task_id == task_id)
        .options(joinedload(TaskUpdate.user))
        .order_by(TaskUpdate.created_at.desc())
    )
    return list(db.scalars(stmt).unique().all())


def create_task_update(
    db: Session,
    *,
    user: User,
    task_id: UUID,
    body: TaskUpdateCreate,
) -> TaskUpdate:
    pair = _task_and_project(db, task_id)
    if pair is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    task, project = pair
    assert_can_create_update(db, user, task, project)
    row = TaskUpdate(
        task_id=task.id,
        user_id=user.id,
        comment=body.comment,
        progress=body.progress,
        is_blocked=body.is_blocked,
    )
    db.add(row)
    try:
        db.flush()
        new_id = row.id
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar la actualización",
        ) from None
    out = db.scalar(
        select(TaskUpdate)
        .where(TaskUpdate.id == new_id)
        .options(joinedload(TaskUpdate.user)),
    )
    if out is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo cargar la actualización",
        )
    return out

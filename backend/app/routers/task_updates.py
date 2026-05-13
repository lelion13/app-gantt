"""Bitácora de avance: `/tasks/{task_id}/updates`."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.task import TaskUpdate
from app.models.user import User
from app.schemas.task_update import TaskUpdateCreate, TaskUpdatePublic
from app.services import task_updates as task_updates_service

router = APIRouter(prefix="/tasks", tags=["task-updates"])


def _to_public(u: TaskUpdate) -> TaskUpdatePublic:
    author = u.user.name if u.user is not None else ""
    return TaskUpdatePublic(
        id=u.id,
        task_id=u.task_id,
        user_id=u.user_id,
        author_name=author,
        comment=u.comment,
        progress=u.progress,
        is_blocked=u.is_blocked,
        created_at=u.created_at,
    )


@router.get("/{task_id}/updates", response_model=list[TaskUpdatePublic])
def list_updates(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    task_id: UUID,
) -> list[TaskUpdatePublic]:
    rows = task_updates_service.list_task_updates(db, user=user, task_id=task_id)
    return [_to_public(u) for u in rows]


@router.post(
    "/{task_id}/updates",
    response_model=TaskUpdatePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_update(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    task_id: UUID,
    body: TaskUpdateCreate,
) -> TaskUpdatePublic:
    row = task_updates_service.create_task_update(
        db,
        user=user,
        task_id=task_id,
        body=body,
    )
    return _to_public(row)

"""Tareas bajo `/projects/{project_id}/tasks` (JWT + membresía)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.project_access import get_project_for_current_user
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.task import (
    TaskAssigneeAdd,
    TaskAssigneeOut,
    TaskCreate,
    TaskDetail,
    TaskPublic,
    TaskUpdate,
)
from app.services import tasks as tasks_service

router = APIRouter(
    prefix="/projects/{project_id}/tasks",
    tags=["tasks"],
)


def get_task_in_project(
    task_id: UUID,
    project: Annotated[Project, Depends(get_project_for_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Task:
    t = tasks_service.get_task_in_project(db, project_id=project.id, task_id=task_id)
    if t is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    return t


def _to_detail(task: Task) -> TaskDetail:
    pub = TaskPublic.model_validate(task)
    assignees = [
        TaskAssigneeOut(
            user_id=a.user_id,
            name=a.user.name,
            email=a.user.email,
        )
        for a in task.assignees
    ]
    return TaskDetail(**pub.model_dump(), assignees=assignees)


@router.get("", response_model=list[TaskPublic])
def list_tasks(
    project: Annotated[Project, Depends(get_project_for_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Task]:
    return tasks_service.list_tasks_for_project(db, project=project)


@router.post("", response_model=TaskDetail, status_code=status.HTTP_201_CREATED)
def create_task(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    body: TaskCreate,
) -> TaskDetail:
    task = tasks_service.create_task(db, project=project, actor=user, body=body)
    return _to_detail(task)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task: Annotated[Task, Depends(get_task_in_project)]) -> TaskDetail:
    return _to_detail(task)


@router.patch("/{task_id}", response_model=TaskDetail)
def patch_task(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    task: Annotated[Task, Depends(get_task_in_project)],
    body: TaskUpdate,
) -> TaskDetail:
    if body.model_dump(exclude_unset=True) == {}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios",
        )
    updated = tasks_service.update_task(
        db,
        project=project,
        actor=user,
        task=task,
        body=body,
    )
    return _to_detail(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    task: Annotated[Task, Depends(get_task_in_project)],
) -> Response:
    tasks_service.soft_delete_task(db, project=project, actor=user, task=task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/assignees", response_model=TaskDetail)
def post_assignee(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    task: Annotated[Task, Depends(get_task_in_project)],
    body: TaskAssigneeAdd,
) -> TaskDetail:
    updated = tasks_service.add_assignee(
        db,
        project=project,
        actor=user,
        task=task,
        body=body,
    )
    return _to_detail(updated)


@router.delete("/{task_id}/assignees/{user_id}", response_model=TaskDetail)
def delete_assignee(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    task: Annotated[Task, Depends(get_task_in_project)],
    user_id: UUID,
) -> TaskDetail:
    updated = tasks_service.remove_assignee(
        db,
        project=project,
        actor=user,
        task=task,
        assignee_user_id=user_id,
    )
    return _to_detail(updated)

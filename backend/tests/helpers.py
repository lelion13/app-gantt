"""Utilidades de datos para tests de integración."""

from __future__ import annotations

from datetime import date

from app.core.security import hash_password
from app.models.enums import AppRole, LifecycleStatus, ProjectRole
from app.models.project import Project, ProjectUser
from app.models.task import Task, TaskUser
from app.models.user import User
from sqlalchemy.orm import Session


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    role: AppRole,
    name: str | None = None,
) -> User:
    u = User(
        name=name or email.split("@")[0],
        email=email.lower().strip(),
        password_hash=hash_password(password),
        app_role=role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def create_project_with_members(
    db: Session,
    *,
    pm: User,
    collaborators: list[User] | None = None,
) -> Project:
    collaborators = collaborators or []
    p = Project(
        title="Proyecto test",
        description=None,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status=LifecycleStatus.in_progress,
        project_manager_id=pm.id,
    )
    db.add(p)
    db.flush()
    db.add(ProjectUser(project_id=p.id, user_id=pm.id, role=ProjectRole.pm))
    for c in collaborators:
        db.add(ProjectUser(project_id=p.id, user_id=c.id, role=ProjectRole.colaborador))
    db.commit()
    db.refresh(p)
    return p


def create_task(
    db: Session,
    *,
    project: Project,
    title: str = "Tarea test",
    end_date: date | None = None,
    status: LifecycleStatus = LifecycleStatus.in_progress,
) -> Task:
    end = end_date or date(2026, 6, 30)
    t = Task(
        project_id=project.id,
        title=title,
        description=None,
        start_date=date(2026, 1, 2),
        end_date=end,
        status=status,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def assign_task(db: Session, *, task: Task, user: User) -> None:
    db.add(TaskUser(task_id=task.id, user_id=user.id))
    db.commit()

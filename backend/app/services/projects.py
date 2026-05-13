"""Lógica de proyectos y membresías."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.enums import AppRole, ProjectRole
from app.models.project import Project, ProjectUser
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectUpdate,
)


def _load_user_active(db: Session, user_id: UUID) -> User | None:
    u = db.get(User, user_id)
    if u is None or u.deleted_at is not None:
        return None
    return u


def _project_with_members(db: Session, project_id: UUID) -> Project | None:
    return db.scalar(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.members).selectinload(ProjectUser.user)),
    )


def list_projects_for_user(db: Session, user: User) -> list[Project]:
    stmt = (
        select(Project)
        .where(
            Project.deleted_at.is_(None),
            Project.id.in_(
                select(ProjectUser.project_id).where(ProjectUser.user_id == user.id),
            ),
        )
        .order_by(Project.title)
    )
    return list(db.scalars(stmt).all())


def get_project_visible_to_user(
    db: Session,
    user: User,
    project_id: UUID,
) -> Project | None:
    row = db.scalar(
        select(ProjectUser.user_id).where(
            ProjectUser.project_id == project_id,
            ProjectUser.user_id == user.id,
        ),
    )
    if row is None:
        return None
    p = _project_with_members(db, project_id)
    if p is None or p.deleted_at is not None:
        return None
    return p


def user_is_project_member(db: Session, project_id: UUID, user_id: UUID) -> bool:
    return db.get(ProjectUser, (project_id, user_id)) is not None


def assert_can_create_project(actor: User) -> None:
    if actor.app_role not in (AppRole.admin, AppRole.pm):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Prohibido",
        )


def create_project(db: Session, actor: User, body: ProjectCreate) -> Project:
    assert_can_create_project(actor)
    pm = _load_user_active(db, body.project_manager_id)
    if pm is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_manager_id inválido o usuario inactivo",
        )
    collab_ids = list(dict.fromkeys(body.initial_collaborator_user_ids))
    for uid in collab_ids:
        if uid == body.project_manager_id:
            continue
        u = _load_user_active(db, uid)
        if u is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Colaborador inválido o usuario inactivo",
            )

    desc: str | None = None
    if body.description is not None:
        s = body.description.strip()
        desc = s if s else None
    project = Project(
        title=body.title.strip(),
        description=desc,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        project_manager_id=body.project_manager_id,
    )
    db.add(project)
    db.flush()
    db.add(
        ProjectUser(
            project_id=project.id,
            user_id=body.project_manager_id,
            role=ProjectRole.pm,
        ),
    )
    for uid in collab_ids:
        if uid == body.project_manager_id:
            continue
        db.add(
            ProjectUser(
                project_id=project.id,
                user_id=uid,
                role=ProjectRole.colaborador,
            ),
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo crear el proyecto",
        ) from None
    out = _project_with_members(db, project.id)
    assert out is not None
    return out


def assert_project_pm(project: Project, actor: User) -> None:
    if project.project_manager_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Prohibido",
        )


def _merged_dates(
    target: Project,
    data: dict,
) -> tuple[date, date]:
    start = data.get("start_date", target.start_date)
    end = data.get("end_date", target.end_date)
    return start, end


def update_project(
    db: Session,
    *,
    project: Project,
    actor: User,
    body: ProjectUpdate,
) -> Project:
    assert_project_pm(project, actor)
    data = body.model_dump(exclude_unset=True)
    start, end = _merged_dates(project, data)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date debe ser mayor o igual que start_date",
        )
    if "title" in data:
        project.title = data["title"].strip()
    if "description" in data:
        raw = data["description"]
        project.description = (
            raw.strip() if isinstance(raw, str) and raw.strip() else None
        )
    if "start_date" in data:
        project.start_date = data["start_date"]
    if "end_date" in data:
        project.end_date = data["end_date"]
    if "status" in data:
        project.status = data["status"]
    if "is_active" in data:
        project.deleted_at = None if data["is_active"] else datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar el proyecto",
        ) from None
    out = _project_with_members(db, project.id)
    assert out is not None
    return out


def add_member(
    db: Session,
    *,
    project: Project,
    actor: User,
    body: ProjectMemberAdd,
) -> Project:
    assert_project_pm(project, actor)
    if body.role != ProjectRole.colaborador:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use el endpoint de transferencia para asignar PM",
        )
    u = _load_user_active(db, body.user_id)
    if u is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inválido o inactivo",
        )
    existing = db.get(ProjectUser, (project.id, body.user_id))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El usuario ya es miembro del proyecto",
        )
    db.add(
        ProjectUser(
            project_id=project.id,
            user_id=body.user_id,
            role=ProjectRole.colaborador,
        ),
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo agregar el miembro",
        ) from None
    out = _project_with_members(db, project.id)
    assert out is not None
    return out


def remove_member(
    db: Session,
    *,
    project: Project,
    actor: User,
    member_user_id: UUID,
) -> Project:
    assert_project_pm(project, actor)
    if member_user_id == project.project_manager_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede eliminar al PM; use transferencia de PM",
        )
    row = db.get(ProjectUser, (project.id, member_user_id))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Miembro no encontrado",
        )
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo eliminar el miembro",
        ) from None
    out = _project_with_members(db, project.id)
    assert out is not None
    return out


def transfer_project_pm(
    db: Session,
    *,
    project: Project,
    actor: User,
    new_project_manager_id: UUID,
) -> Project:
    assert_project_pm(project, actor)
    if new_project_manager_id == project.project_manager_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios",
        )
    new_row = db.get(ProjectUser, (project.id, new_project_manager_id))
    if new_row is None or new_row.role != ProjectRole.colaborador:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo PM debe ser un colaborador actual del proyecto",
        )
    old_row = db.get(ProjectUser, (project.id, project.project_manager_id))
    if old_row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Estado de membresías inconsistente",
        )
    old_row.role = ProjectRole.colaborador
    new_row.role = ProjectRole.pm
    project.project_manager_id = new_project_manager_id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo transferir el PM",
        ) from None
    out = _project_with_members(db, project.id)
    assert out is not None
    return out


def soft_delete_project(db: Session, *, project: Project, actor: User) -> None:
    assert_project_pm(project, actor)
    if project.deleted_at is not None:
        return
    project.deleted_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo eliminar el proyecto",
        ) from None

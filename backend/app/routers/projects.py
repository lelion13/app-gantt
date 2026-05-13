"""Proyectos y membresías (JWT)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.project_access import get_project_for_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectDetail,
    ProjectMemberAdd,
    ProjectMemberOut,
    ProjectPublic,
    ProjectUpdate,
    TransferPmBody,
)
from app.services import projects as projects_service

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_detail(p: Project) -> ProjectDetail:
    pub = ProjectPublic.model_validate(p)
    members = [
        ProjectMemberOut(
            user_id=m.user_id,
            role=m.role,
            name=m.user.name,
            email=m.user.email,
        )
        for m in p.members
    ]
    return ProjectDetail(**pub.model_dump(), members=members)


@router.get("", response_model=list[ProjectPublic])
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[Project]:
    return projects_service.list_projects_for_user(db, user)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    body: ProjectCreate,
) -> ProjectDetail:
    p = projects_service.create_project(db, user, body)
    return _to_detail(p)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project: Annotated[Project, Depends(get_project_for_current_user)],
) -> ProjectDetail:
    return _to_detail(project)


@router.patch("/{project_id}", response_model=ProjectDetail)
def patch_project(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    body: ProjectUpdate,
) -> ProjectDetail:
    if body.model_dump(exclude_unset=True) == {}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios",
        )
    updated = projects_service.update_project(
        db, project=project, actor=user, body=body
    )
    return _to_detail(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
) -> Response:
    projects_service.soft_delete_project(db, project=project, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/members", response_model=ProjectDetail)
def post_member(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    body: ProjectMemberAdd,
) -> ProjectDetail:
    updated = projects_service.add_member(db, project=project, actor=user, body=body)
    return _to_detail(updated)


@router.delete("/{project_id}/members/{user_id}", response_model=ProjectDetail)
def delete_member(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    user_id: UUID,
) -> ProjectDetail:
    updated = projects_service.remove_member(
        db,
        project=project,
        actor=user,
        member_user_id=user_id,
    )
    return _to_detail(updated)


@router.post("/{project_id}/transfer-pm", response_model=ProjectDetail)
def post_transfer_pm(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    project: Annotated[Project, Depends(get_project_for_current_user)],
    body: TransferPmBody,
) -> ProjectDetail:
    updated = projects_service.transfer_project_pm(
        db,
        project=project,
        actor=user,
        new_project_manager_id=body.new_project_manager_id,
    )
    return _to_detail(updated)

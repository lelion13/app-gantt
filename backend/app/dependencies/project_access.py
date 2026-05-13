"""Acceso a proyectos visibles para el usuario autenticado."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.project import Project
from app.models.user import User
from app.services import projects as projects_service


def get_project_for_current_user(
    project_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Project:
    p = projects_service.get_project_visible_to_user(db, user, project_id)
    if p is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontrado",
        )
    return p

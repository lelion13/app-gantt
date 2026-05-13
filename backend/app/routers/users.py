"""Gestión de usuarios (solo administradores)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_app_roles
from app.models.enums import AppRole
from app.models.user import User
from app.schemas.user import UserCreate, UserPublic, UserUpdate
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["users"])
_admin_dep = Depends(require_app_roles(AppRole.admin))


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, _admin_dep],
    include_deleted: Annotated[
        bool,
        Query(description="Incluir usuarios dados de baja (soft delete)"),
    ] = False,
) -> list[User]:
    return users_service.list_users(db, include_deleted=include_deleted)


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, _admin_dep],
    body: UserCreate,
) -> User:
    return users_service.create_user(db, body)


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, _admin_dep],
    user_id: UUID,
) -> User:
    user = users_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado"
        )
    return user


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, _admin_dep],
    user_id: UUID,
    body: UserUpdate,
) -> User:
    if body.model_dump(exclude_unset=True) == {}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin cambios",
        )
    user = users_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado"
        )
    return users_service.update_user(
        db,
        target=user,
        body=body,
        acting_admin_id=admin.id,
    )

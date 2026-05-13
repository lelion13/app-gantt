"""Lógica de usuarios (solo invocada tras verificar rol admin en el router)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def list_users(db: Session, *, include_deleted: bool = False) -> list[User]:
    stmt = select(User).order_by(User.email)
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    return list(db.scalars(stmt).all())


def get_user(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, body: UserCreate) -> User:
    email = body.email.lower().strip()
    existing = db.scalar(
        select(User).where(User.email == email, User.deleted_at.is_(None)),
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está en uso",
        )
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        app_role=body.app_role,
        telegram_id=body.telegram_id.strip() if body.telegram_id else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo crear el usuario",
        ) from None
    db.refresh(user)
    return user


def update_user(
    db: Session,
    *,
    target: User,
    body: UserUpdate,
    acting_admin_id: UUID,
) -> User:
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        target.name = data["name"].strip()
    if "email" in data:
        email = data["email"].lower().strip()
        conflict = db.scalar(
            select(User).where(
                User.email == email,
                User.id != target.id,
                User.deleted_at.is_(None),
            ),
        )
        if conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email ya está en uso",
            )
        target.email = email
    if "password" in data:
        target.password_hash = hash_password(data["password"])
    if "app_role" in data:
        target.app_role = data["app_role"]
    if "telegram_id" in data:
        raw = data["telegram_id"]
        target.telegram_id = (
            raw.strip() if isinstance(raw, str) and raw.strip() else None
        )
    if "is_active" in data:
        if not data["is_active"] and target.id == acting_admin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puede desactivarse a sí mismo",
            )
        target.deleted_at = None if data["is_active"] else datetime.now(UTC)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar el usuario",
        ) from None
    db.refresh(target)
    return target

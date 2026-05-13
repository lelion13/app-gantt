"""Rutas de autenticación."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.login_rate_limit import enforce_login_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Emite JWT de acceso (mensaje genérico si falla)."""
    enforce_login_rate_limit(request)
    email = body.email.lower().strip()
    user = db.scalar(
        select(User).where(User.email == email, User.deleted_at.is_(None)),
    )
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    token = create_access_token(
        subject=str(user.id),
        role=str(user.app_role),
    )
    return TokenResponse(access_token=token)

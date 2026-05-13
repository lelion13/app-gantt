"""Hash de contraseñas (bcrypt) y JWT access."""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from app.core.config import get_settings


def hash_password(plain: str) -> str:
    """Genera hash bcrypt (salt incluido en el string devuelto)."""
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("ascii")


def verify_password(plain: str, password_hash: str) -> bool:
    """Verifica contraseña contra el hash almacenado."""
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            password_hash.encode("ascii"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(*, subject: str, role: str) -> str:
    """Crea JWT de acceso (claims mínimos: sub, role, exp)."""
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_alg,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida firma y expiración del JWT."""
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_alg],
    )


def decode_access_token_safe(token: str) -> dict[str, Any] | None:
    """Decodifica JWT o devuelve None si es inválido/expirado (sin loguear el token)."""
    try:
        return decode_access_token(token)
    except InvalidTokenError:
        return None

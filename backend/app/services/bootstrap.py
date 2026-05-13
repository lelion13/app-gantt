"""Alta idempotente del primer administrador."""

from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_engine
from app.models.enums import AppRole
from app.models.user import User


def ensure_bootstrap_admin() -> None:
    """Si no hay admin activo y hay vars de bootstrap, crea un usuario admin."""
    settings = get_settings()
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return

    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.app_role == AppRole.admin,
                User.deleted_at.is_(None),
            ),
        )
        if count and count > 0:
            return

        email = settings.bootstrap_admin_email.lower().strip()
        existing = db.scalar(
            select(User).where(User.email == email, User.deleted_at.is_(None)),
        )
        if existing is not None:
            return

        user = User(
            name="Administrator",
            email=email,
            password_hash=hash_password(settings.bootstrap_admin_password),
            app_role=AppRole.admin,
        )
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

"""Base declarativa compartida por los modelos."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Raíz de metadata para Alembic y modelos."""

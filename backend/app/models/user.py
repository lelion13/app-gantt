"""Usuario de aplicación."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AppRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    app_role: Mapped[AppRole] = mapped_column(
        Enum(AppRole, native_enum=False, length=32),
        nullable=False,
    )
    telegram_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    projects_managed: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="project_manager",
        foreign_keys="Project.project_manager_id",
    )
    project_memberships: Mapped[list["ProjectUser"]] = relationship(
        "ProjectUser",
        back_populates="user",
    )
    task_assignments: Mapped[list["TaskUser"]] = relationship(
        "TaskUser",
        back_populates="user",
    )
    task_updates: Mapped[list["TaskUpdate"]] = relationship(
        "TaskUpdate",
        back_populates="user",
    )

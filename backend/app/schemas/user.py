"""Schemas de usuario (admin)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AppRole


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    app_role: AppRole
    telegram_id: str | None = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=256)
    app_role: AppRole | None = None
    telegram_id: str | None = Field(default=None, max_length=64)
    is_active: bool | None = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    app_role: AppRole
    telegram_id: str | None = None
    deleted_at: datetime | None = None

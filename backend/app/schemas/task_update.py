"""Schemas para bitácora de avance (task_updates)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskUpdateCreate(BaseModel):
    comment: str = Field(default="", max_length=2000)
    progress: int | None = Field(default=None, ge=0, le=100)
    is_blocked: bool = False

    @field_validator("comment", mode="before")
    @classmethod
    def strip_comment(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class TaskUpdatePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    user_id: UUID
    author_name: str
    comment: str
    progress: int | None
    is_blocked: bool
    created_at: datetime

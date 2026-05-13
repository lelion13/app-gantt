"""Schemas de proyecto y membresías."""

from datetime import date, datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import LifecycleStatus, ProjectRole


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    start_date: date
    end_date: date
    status: LifecycleStatus
    project_manager_id: UUID
    initial_collaborator_user_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_date_range(self) -> Self:
        if self.end_date < self.start_date:
            msg = "end_date debe ser mayor o igual que start_date"
            raise ValueError(msg)
        return self


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: LifecycleStatus | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> Self:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            msg = "end_date debe ser mayor o igual que start_date"
            raise ValueError(msg)
        return self


class ProjectMemberOut(BaseModel):
    user_id: UUID
    role: ProjectRole
    name: str
    email: str


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    start_date: date
    end_date: date
    status: LifecycleStatus
    project_manager_id: UUID
    deleted_at: datetime | None


class ProjectDetail(ProjectPublic):
    members: list[ProjectMemberOut]


class ProjectMemberAdd(BaseModel):
    user_id: UUID
    role: ProjectRole = ProjectRole.colaborador


class TransferPmBody(BaseModel):
    new_project_manager_id: UUID

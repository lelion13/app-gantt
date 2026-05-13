"""Enumeraciones persistidas como VARCHAR (PostgreSQL)."""

from enum import StrEnum


class AppRole(StrEnum):
    admin = "admin"
    pm = "pm"
    usuario = "usuario"


class ProjectRole(StrEnum):
    pm = "pm"
    colaborador = "colaborador"


class LifecycleStatus(StrEnum):
    pending = "pending"
    estimated = "estimated"
    in_progress = "in_progress"
    completed = "completed"


class OutboxStatus(StrEnum):
    pending = "pending"
    sent = "sent"
    failed = "failed"

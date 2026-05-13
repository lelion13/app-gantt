"""Importar modelos para registrar metadata en Alembic."""

# isort: off — orden para resolver relaciones (User antes que Project).
from app.models.user import User
from app.models.project import Project, ProjectUser
from app.models.task import Task, TaskUpdate, TaskUser
from app.models.notification import NotificationOutbox

__all__ = [
    "NotificationOutbox",
    "Project",
    "ProjectUser",
    "Task",
    "TaskUpdate",
    "TaskUser",
    "User",
]

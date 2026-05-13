from datetime import UTC, datetime

from app.models.enums import AppRole
from tests.helpers import (
    assign_task,
    create_project_with_members,
    create_task,
    create_user,
)


def test_task_update_allowed_assignee_and_pm_denied_other_member(
    client,
    db_session,
) -> None:
    pm = create_user(db_session, email="pm@example.com", password="p", role=AppRole.pm)
    assignee = create_user(
        db_session, email="a@example.com", password="a", role=AppRole.usuario
    )
    other = create_user(
        db_session, email="o@example.com", password="o", role=AppRole.usuario
    )

    project = create_project_with_members(
        db_session, pm=pm, collaborators=[assignee, other]
    )
    task = create_task(db_session, project=project, title="T1")
    assign_task(db_session, task=task, user=assignee)

    assignee_tok = client.post(
        "/api/v1/auth/login",
        json={"email": "a@example.com", "password": "a"},
    ).json()["access_token"]
    ok = client.post(
        f"/api/v1/tasks/{task.id}/updates",
        headers={"Authorization": f"Bearer {assignee_tok}"},
        json={"comment": "avance", "progress": 10, "is_blocked": False},
    )
    assert ok.status_code == 201

    pm_tok = client.post(
        "/api/v1/auth/login",
        json={"email": "pm@example.com", "password": "p"},
    ).json()["access_token"]
    pm_ok = client.post(
        f"/api/v1/tasks/{task.id}/updates",
        headers={"Authorization": f"Bearer {pm_tok}"},
        json={"comment": "pm", "progress": None, "is_blocked": False},
    )
    assert pm_ok.status_code == 201

    other_tok = client.post(
        "/api/v1/auth/login",
        json={"email": "o@example.com", "password": "o"},
    ).json()["access_token"]
    denied = client.post(
        f"/api/v1/tasks/{task.id}/updates",
        headers={"Authorization": f"Bearer {other_tok}"},
        json={"comment": "x", "progress": None, "is_blocked": False},
    )
    assert denied.status_code == 403


def test_task_update_forbidden_when_task_deleted(client, db_session) -> None:
    pm = create_user(db_session, email="pm@example.com", password="p", role=AppRole.pm)
    assignee = create_user(
        db_session, email="a@example.com", password="a", role=AppRole.usuario
    )
    project = create_project_with_members(db_session, pm=pm, collaborators=[assignee])
    task = create_task(db_session, project=project)
    assign_task(db_session, task=task, user=assignee)
    task.deleted_at = datetime.now(UTC)
    db_session.add(task)
    db_session.commit()

    tok = client.post(
        "/api/v1/auth/login",
        json={"email": "a@example.com", "password": "a"},
    ).json()["access_token"]
    r = client.post(
        f"/api/v1/tasks/{task.id}/updates",
        headers={"Authorization": f"Bearer {tok}"},
        json={"comment": "x", "progress": None, "is_blocked": False},
    )
    assert r.status_code == 404

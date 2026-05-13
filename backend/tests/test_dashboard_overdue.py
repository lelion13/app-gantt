from datetime import date

from app.models.enums import AppRole
from tests.helpers import (
    assign_task,
    create_project_with_members,
    create_task,
    create_user,
)


def test_me_tasks_overdue_includes_old_end_date(client, db_session) -> None:
    pm = create_user(db_session, email="pm@example.com", password="p", role=AppRole.pm)
    u = create_user(
        db_session, email="u@example.com", password="u", role=AppRole.usuario
    )
    project = create_project_with_members(db_session, pm=pm, collaborators=[u])
    task = create_task(
        db_session,
        project=project,
        title="Vieja",
        end_date=date(2000, 1, 1),
    )
    assign_task(db_session, task=task, user=u)

    tok = client.post(
        "/api/v1/auth/login",
        json={"email": "u@example.com", "password": "u"},
    ).json()["access_token"]
    r = client.get(
        "/api/v1/me/tasks?view=overdue",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert str(task.id) in ids

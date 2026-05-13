from uuid import UUID

from app.models.enums import AppRole
from tests.helpers import create_user


def test_transfer_pm_updates_manager_and_roles(client, db_session) -> None:
    create_user(db_session, email="admin@example.com", password="a", role=AppRole.admin)
    pm = create_user(db_session, email="pm@example.com", password="p", role=AppRole.pm)
    collab = create_user(
        db_session, email="c@example.com", password="c", role=AppRole.usuario
    )

    admin_tok = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "a"},
    ).json()["access_token"]

    r = client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={
            "title": "P1",
            "description": None,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "status": "in_progress",
            "project_manager_id": str(pm.id),
            "initial_collaborator_user_ids": [str(collab.id)],
        },
    )
    assert r.status_code == 201
    project_id = UUID(r.json()["id"])

    pm_tok = client.post(
        "/api/v1/auth/login",
        json={"email": "pm@example.com", "password": "p"},
    ).json()["access_token"]

    tr = client.post(
        f"/api/v1/projects/{project_id}/transfer-pm",
        headers={"Authorization": f"Bearer {pm_tok}"},
        json={"new_project_manager_id": str(collab.id)},
    )
    assert tr.status_code == 200
    body = tr.json()
    assert UUID(body["project_manager_id"]) == collab.id
    roles = {UUID(m["user_id"]): m["role"] for m in body["members"]}
    assert roles[pm.id] == "colaborador"
    assert roles[collab.id] == "pm"

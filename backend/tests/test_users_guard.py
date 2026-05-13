from app.models.enums import AppRole
from tests.helpers import create_user


def test_users_list_forbidden_for_non_admin(client, db_session) -> None:
    create_user(db_session, email="pm@example.com", password="p", role=AppRole.pm)
    tok = client.post(
        "/api/v1/auth/login",
        json={"email": "pm@example.com", "password": "p"},
    ).json()["access_token"]
    r = client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 403

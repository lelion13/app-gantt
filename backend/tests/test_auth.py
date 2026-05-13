from app.models.enums import AppRole
from tests.helpers import create_user


def test_login_fails_bad_password(client, db_session) -> None:
    create_user(
        db_session, email="u@example.com", password="secretpass", role=AppRole.usuario
    )
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "u@example.com", "password": "wrong"},
    )
    assert r.status_code == 401


def test_login_success_returns_token(client, db_session) -> None:
    create_user(
        db_session, email="u@example.com", password="secretpass", role=AppRole.usuario
    )
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "u@example.com", "password": "secretpass"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"

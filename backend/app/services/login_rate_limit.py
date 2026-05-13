"""Límite simple de frecuencia para intentos de login (MVP, en memoria por proceso)."""

from __future__ import annotations

import os
from time import monotonic

from fastapi import HTTPException, Request, status

_WINDOW_SEC = 60.0
_MAX_ATTEMPTS = 20
_attempts: dict[str, list[float]] = {}


def _enabled() -> bool:
    return os.environ.get("DISABLE_LOGIN_RATE_LIMIT", "").lower() not in (
        "1",
        "true",
        "yes",
    )


def enforce_login_rate_limit(request: Request) -> None:
    if not _enabled():
        return
    key = request.client.host if request.client else "unknown"
    now = monotonic()
    bucket = _attempts.setdefault(key, [])
    while bucket and now - bucket[0] > _WINDOW_SEC:
        bucket.pop(0)
    if len(bucket) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos",
        )
    bucket.append(now)


def reset_login_rate_limits() -> None:
    """Solo tests: vacía contadores."""
    _attempts.clear()

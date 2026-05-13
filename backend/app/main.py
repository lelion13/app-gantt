"""Aplicación FastAPI (MVP app-gantt)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.routers import auth, health, me, project_tasks, projects, task_updates, users
from app.services.bootstrap import ensure_bootstrap_admin


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_bootstrap_admin()
    yield


app = FastAPI(
    title="app-gantt API",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Rechaza bodies demasiado grandes según Content-Length (aprox.)."""

    async def dispatch(self, request: Request, call_next):
        limit = get_settings().http_max_body_bytes
        raw = request.headers.get("content-length")
        if raw is not None:
            try:
                n = int(raw)
            except ValueError:
                n = 0
            if n > limit:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Solicitud demasiado grande"},
                )
        return await call_next(request)


app.add_middleware(MaxBodySizeMiddleware)

app.include_router(health.router_root)
api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth.router)
api_v1.include_router(health.router_v1)
api_v1.include_router(users.router)
api_v1.include_router(projects.router)
api_v1.include_router(project_tasks.router)
api_v1.include_router(task_updates.router)
api_v1.include_router(me.router)
app.include_router(api_v1)

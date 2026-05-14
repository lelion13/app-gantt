# app-gantt

Monorepo del MVP: seguimiento de proyectos y **avance real por tarea** (FastAPI + React + PostgreSQL).

## Documentación

- **[proyecto.md](./proyecto.md)** — especificación funcional y técnica.
- **[docs/plan-implementacion-mvp.md](./docs/plan-implementacion-mvp.md)** — plan de fases e implementación.
- **[docs/adicion-ui-alta-proyecto.md](./docs/adicion-ui-alta-proyecto.md)** — alta de proyecto desde el panel (post-MVP / adición al spec inicial).
- **[docs/adicion-ui-alta-tarea-en-proyecto.md](./docs/adicion-ui-alta-tarea-en-proyecto.md)** — ABM de tareas en proyecto + asignaciones (UI).

## Requisitos

- Python **3.11+**
- Node.js **20+** (LTS recomendado)
- Docker (a partir de la **fase 1** para Postgres / stack completo)

## Arranque local (desarrollo)

### Backend (lint / formato — fase 0)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
ruff check app alembic tests
ruff format app alembic tests
python -m black --check app alembic tests
# Arranque local sin Docker (cuando exista la API completa):
# uvicorn app.main:app --reload
```

### Migraciones (Alembic — fase 2)

Con Postgres en marcha (`docker compose up db` o stack completo) y `DATABASE_URL` apuntando a la base:

```bash
cd backend
# Windows: set DATABASE_URL=postgresql+psycopg://...
# PowerShell: $env:DATABASE_URL="postgresql+psycopg://app_gantt:app_gantt@localhost:5432/app_gantt"
python -m alembic upgrade head
```

Desde contenedor backend (WORKDIR `/app`): `python -m alembic upgrade head` con la misma variable.

### Auth (fase 3)

Tras migrar y levantar el backend (con `JWT_SECRET` y, la primera vez, `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` si no hay ningún admin):

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"tu_password\"}"
```

Respuesta: `{"access_token":"...","token_type":"bearer"}`. Health: `GET http://localhost:8000/api/v1/health` (incluye `database`: `ok` | `unreachable`).

### Docker Compose (fase 1 — desarrollo)

Requisito: **Docker Engine** + plugin Compose v2.

```bash
# Opcional: copiar .env.example a .env y ajustar contraseñas
docker compose up --build
```

- **PostgreSQL:** `localhost:${POSTGRES_PORT:-5432}` (persistencia en volumen `postgres_data`).
- **API:** `http://localhost:8000/api/v1/health`
- **Frontend (Vite):** `http://localhost:5173` — las llamadas a `/api/...` se proxifican al backend (`VITE_DEV_PROXY_TARGET` en compose).

### Docker Compose (producción en VPS)

Tras publicar imágenes en GHCR (workflow **Publish container images to GHCR**), en el servidor:

```bash
cp .env.example .env
# Completar POSTGRES_*, DATABASE_URL (host `db`), GHCR_*_IMAGE, GANTT_HOST, JWT_*, CORS_ORIGINS, etc.
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Traefik en el host debe usar el **Docker provider** (como `traefik-wpez`); **no** hace falta red externa compartida: los labels `Host` + `PathPrefix(/api)` + prioridad definen el enrutamiento (ver `proyecto.md`).

En **Hostinger / VPS** el flujo típico es: variables en `.env` (incl. `GHCR_*_IMAGE`, `GANTT_HOST`, `JWT_SECRET`, `DATABASE_URL` con host `db`, `CORS_ORIGINS` solo orígenes reales del front), `docker compose -f docker-compose.prod.yml pull && up -d`, y Traefik en el host leyendo labels del contenedor (sin red Docker externa compartida con Traefik).

**Producción — variables de endurecimiento (fase 9):** `APP_ENV=production`, `CORS_ORIGINS` restrictivo (sin comodines innecesarios), `HTTP_MAX_BODY_BYTES` acorde al uso, `JWT_SECRET` fuerte. **No** definas `DISABLE_LOGIN_RATE_LIMIT=1` en producción (el rate limit de login queda activo por IP).

### Tests backend (`pytest` — fase 9)

Requiere **PostgreSQL** accesible y una base dedicada a tests (por defecto `app_gantt_test`, mismo usuario que en `.env.example`). Con `docker compose up db` en otra terminal:

```bash
# Una sola vez: crear la base de tests (ajusta usuario/host si tu .env difiere)
docker compose exec db psql -U app_gantt -d app_gantt -c "CREATE DATABASE app_gantt_test;"
```

```bash
cd backend
pip install -e ".[dev]"
# PowerShell (coincide con conftest por defecto):
$env:DATABASE_URL="postgresql+psycopg://app_gantt:app_gantt@127.0.0.1:5432/app_gantt_test?sslmode=disable"
python -m pytest -q
```

En CI (`.github/workflows/ci.yml`) se levanta Postgres 16 con `POSTGRES_DB=app_gantt_test`. Los tests desactivan el rate limit de login vía entorno (`DISABLE_LOGIN_RATE_LIMIT=1` en `tests/conftest.py`).

### Checklist smoke MVP (manual)

Criterio alineado con [proyecto.md](./proyecto.md): con `docker compose up` local → login → crear proyecto (PM + colaboradores iniciales) → crear tarea → asignar → task update → listados del dashboard (mis tareas / en progreso / vencidas) → transferencia de PM → soft delete de tarea o proyecto sin romper consistencia.

### Frontend (lint / formato — fase 0)

```bash
cd frontend
npm ci
npm run lint
npm run format:check
npm run dev
```

Copiá variables de entorno desde **`.env.example`** a **`.env`** para Docker o para desarrollo híbrido (solo DB en Docker, front/back en host).

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `backend/` | API FastAPI |
| `frontend/` | SPA React + Vite + Tailwind |
| `docs/` | Plan y notas |
| `docker-compose.yml` | Desarrollo: Postgres + backend (reload) + frontend (Vite) |
| `docker-compose.prod.yml` | Producción: imágenes GHCR + labels Traefik |

## Licencia

Privado / uso interno salvo que se indique lo contrario.

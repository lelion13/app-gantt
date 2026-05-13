# Plan de implementación — MVP (app-gantt)

Fuente de verdad funcional: [proyecto.md](../proyecto.md). Este plan ordena el trabajo para llegar al **criterio de listo** definido ahí (smoke end-to-end + transfer PM + soft delete).

**Convenciones**

- API bajo prefijo `/api/v1` (ajustar si el front usa solo `/api` vía proxy: mantener una sola convención documentada en `.env.example`).
- Misma URL en prod: Nginx sirve el SPA; Traefik enruta `PathPrefix(/api)` al backend (patrón tipo `app-cfc` en el VPS).
- Idioma UI: español.

---

## Fase 0 — Monorepo y estándares

| # | Tarea | Notas |
|---|--------|--------|
| 0.1 | Crear carpetas `backend/`, `frontend/`, `docs/`, `.github/workflows/` | Raíz del repo — **hecho** |
| 0.2 | `README.md` raíz: cómo levantar local + enlace a `proyecto.md` y este plan | **hecho** |
| 0.3 | **`.env.example`** (backend + compose): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `APP_TIMEZONE`, `CORS_ORIGINS`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `IMAGE_TAG`, vars Postgres | **hecho** |
| 0.4 | `.gitignore` (Python, Node, `.env`, `__pycache__`, `dist`, etc.) | **hecho** |
| 0.5 | Formato/lint: backend `ruff` + `black` (o equivalente); frontend ESLint + Prettier | **hecho** (`package-lock.json`, CI en `.github/workflows/ci.yml`) |

**Salida:** repo clonable con instrucciones mínimas.

---

## Fase 1 — Infra local (Docker)

| # | Tarea | Notas |
|---|--------|--------|
| 1.1 | `docker-compose.yml` (dev): `postgres`, `backend` (hot reload opcional), `frontend` (dev server) o build estático vía Nginx en perfil `prod` | Volúmenes para DB — **hecho** |
| 1.2 | Dockerfile backend: multi-stage si aplica; usuario no root | Puerto 8000 interno — **hecho** |
| 1.3 | Dockerfile frontend prod: `npm ci` + build + Nginx con SPA fallback | `expose` 80 — **hecho** |
| 1.4 | Compose **producción** (o override): labels Traefik como en `app-cfc` — **sin** `external_network` Traefik (Traefik en host + Docker provider) | `Host(\`gantt.lionapp.cloud\`)`, API `PathPrefix` + **prioridad** > web — **hecho** (`docker-compose.prod.yml`, `GANTT_HOST`) |
| 1.5 | GHCR: workflow build/push `backend` y `frontend` con tag `$GITHUB_SHA` y `latest` opcional | Login `GITHUB_TOKEN` — **hecho** (`.github/workflows/ghcr.yml`, tags `sha` corto + `latest` en main/master) |

**Salida:** `docker compose up` levanta stack; imágenes publicables.

---

## Fase 2 — Base de datos y modelos

| # | Tarea | Notas |
|---|--------|--------|
| 2.1 | Alembic inicial; conexión async o sync (elegir una y mantener) | **Hecho** — SQLAlchemy **sync** + `DATABASE_URL` en `alembic/env.py` |
| 2.2 | Modelo `User`: UUID PK, `name`, `email` único, `password_hash`, `app_role` (`admin` \| `pm` \| `usuario`), `telegram_id` nullable, `deleted_at` nullable (si se adopta soft delete de usuarios) | **Hecho** — índice único parcial `email` activo |
| 2.3 | Modelo `Project`: campos del spec + `project_manager_id` FK + `deleted_at` | **Hecho** |
| 2.4 | Modelo `ProjectUser`: `project_id`, `user_id`, `role` (`pm` \| `colaborador`); **unique partial** o validación transaccional: **un solo `pm` por proyecto** | Unique `(project_id, user_id)` + **índice único parcial** `role='pm'` |
| 2.5 | Modelo `Task`: FK proyecto + `deleted_at` | **Hecho** |
| 2.6 | Modelo `TaskUser`: `task_id`, `user_id` | **Hecho** |
| 2.7 | Modelo `TaskUpdate`: campos del spec + `created_at` | **Hecho** — `CHECK` progreso 0–100 |
| 2.8 | Modelo `NotificationOutbox`: tipo, payload JSON, estado `pending`, timestamps | **Hecho** |
| 2.9 | Migraciones revisadas en limpio (orden dependencias FK) | **Hecho** — revisión `001_initial_schema` |

**Salida:** `alembic upgrade head` en Postgres vacío.

---

## Fase 3 — Core backend (config, seguridad, bootstrap)

| # | Tarea | Notas |
|---|--------|--------|
| 3.1 | `core/config.py` (Pydantic Settings): todas las vars de `.env.example` | **Hecho** — `get_settings()` con `lru_cache` |
| 3.2 | Hash/verify bcrypt; no loguear passwords ni JWT | **Hecho** — `app/core/security.py` |
| 3.3 | Crear access JWT; decodificar y validar expiración/firma | **Hecho** — PyJWT, TTL desde env |
| 3.4 | **Bootstrap admin**: al startup, si no hay ningún `User` con `app_role=admin` y existen vars bootstrap, crear admin | **Hecho** — `app/services/bootstrap.py` + `lifespan` |
| 3.5 | `dependencies/get_current_user`, `require_app_roles(...)` | **Hecho** — `app/dependencies/auth.py` |
| 3.6 | Endpoint `POST /api/v1/auth/login` (o `/auth/token`): email+password → JWT; errores genéricos | **Hecho** — `POST /api/v1/auth/login` |
| 3.7 | Endpoint `GET /health` (DB ping opcional) | **Hecho** — `GET /health`, `GET /health/full`, `GET /api/v1/health` (ping DB, siempre 200) |

**Salida:** login funcional contra DB con admin bootstrap.

---

## Fase 4 — Usuarios (admin)

| # | Tarea | Notas |
|---|--------|--------|
| 4.1 | Schemas Pydantic: create/update user (sin password en responses) | **Hecho** — `app/schemas/user.py` |
| 4.2 | `POST /api/v1/users` (admin): crear usuario con `app_role`, password inicial | **Hecho** — solo `admin` |
| 4.3 | `GET/PATCH` usuarios según necesidad MVP (listado acotado, desactivar/soft delete) | **Hecho** — `GET/POST /users`, `GET/PATCH /users/{id}`, query `include_deleted` |

**Salida:** admin puede crear `pm` y `usuario` para pruebas.

---

## Fase 5 — Proyectos y membresías

| # | Tarea | Notas |
|---|--------|--------|
| 5.1 | Servicio transaccional **`POST /api/v1/projects`**: solo `admin` o `pm` global; crea `Project` + `ProjectUser` único `pm` (= `project_manager_id`) + colaboradores iniciales | **Hecho** — `app/services/projects.py` + schemas |
| 5.2 | `GET /api/v1/projects` filtrado por membresía (y reglas admin sin membresía) | **Hecho** — solo proyectos con fila en `project_users` |
| 5.3 | `GET /api/v1/projects/{id}` detalle + miembros | **Hecho** — 404 si borrado o sin membresía |
| 5.4 | `PATCH /api/v1/projects/{id}`: solo PM del proyecto; no cambiar `project_manager_id` aquí | **Hecho** — `is_active` restaura / baja lógica |
| 5.5 | `POST /api/v1/projects/{id}/members`: solo PM; body rol típico `colaborador` | **Hecho** — rechaza rol `pm` |
| 5.6 | `DELETE /api/v1/projects/{id}/members/{user_id}`: solo PM; no eliminar PM consigo mismo sin transfer | **Hecho** |
| 5.7 | **`POST /api/v1/projects/{id}/transfer-pm`**: transacción — nuevo PM debe ser colaborador actual; antiguo PM → `colaborador`; actualizar `project_manager_id` | **Hecho** |
| 5.8 | Soft delete proyecto: `PATCH` o `DELETE` que setea `deleted_at` | **Hecho** — `DELETE /projects/{id}` + `PATCH` con `is_active` |

**Salida:** flujo completo creación → miembros → transfer PM → soft delete proyecto.

---

## Fase 6 — Tareas y asignaciones

| # | Tarea | Notas |
|---|--------|--------|
| 6.1 | CRUD tareas bajo proyecto: crear/listar/detalle/patch; solo PM del proyecto para mutaciones que correspondan | **Hecho** — `GET/POST /projects/{id}/tasks`, `GET/PATCH/DELETE .../tasks/{task_id}`; proyecto vía `get_project_for_current_user` |
| 6.2 | Asignación `task_users`: endpoints o sub-recurso; PM gestiona | **Hecho** — `POST/DELETE .../tasks/{task_id}/assignees` |
| 6.3 | Colaborador: `PATCH` estado/fechas **solo** si está en `task_users` | **Hecho** — 403 si no asignado o campos no permitidos; tests automatizados pendientes en CI |
| 6.4 | PM: modificar cualquier tarea del proyecto; asignar/desasignar | **Hecho** |
| 6.5 | Al asignar (alta en `task_users`): insertar fila en **`notification_outbox`** (`pending`) | **Hecho** — `event_type=task_assigned` |
| 6.6 | Soft delete tarea | **Hecho** — `DELETE` + `PATCH` con `is_active` (solo PM) |

**Salida:** tareas con asignaciones y outbox verificable en DB.

---

## Fase 7 — Task updates y agregados dashboard

| # | Tarea | Notas |
|---|--------|--------|
| 7.1 | `POST /api/v1/tasks/{id}/updates` (o bajo proyecto): creador debe ser **asignado** **o** PM del proyecto | **Hecho** — `POST /api/v1/tasks/{task_id}/updates`; tarea borrada → 404 |
| 7.2 | `GET` listado updates por tarea (orden `created_at` desc) | **Hecho** — `GET /api/v1/tasks/{task_id}/updates`; miembros del proyecto |
| 7.3 | Endpoints o query params para dashboard: **mis tareas**, **en progreso**, **vencidas** | **Hecho** — `GET /api/v1/me/tasks?view=mine|in_progress|overdue` (default `mine`); hoy en `APP_TIMEZONE` |
| 7.4 | Índices y queries eficientes (evitar N+1 donde duela) | **Hecho** — `joinedload` en updates; join único en dashboard; migración `002_ix_task_users_user_id` |

**Salida:** API lista para alimentar el dashboard.

---

## Fase 8 — Frontend (React + Tailwind)

| # | Tarea | Notas |
|---|--------|--------|
| 8.1 | Vite + React + TS + Tailwind; `VITE_API_BASE_URL` default `/api` o `/api/v1` alineado al backend | **Hecho** — `frontend/.env.example`, `src/config.ts` |
| 8.2 | Cliente API (fetch/axios) con interceptor JWT | **Hecho** — `src/lib/api.ts` + token en `sessionStorage` |
| 8.3 | Rutas: Login, Dashboard, Proyecto, Lista tareas, Detalle tarea | **Hecho** — React Router 7 |
| 8.4 | Login + almacenamiento sesión + rutas protegidas por rol donde aplique | **Hecho** — `AuthProvider`, `/admin/users` solo `admin` |
| 8.5 | Dashboard: tres bloques (mis / vencidas / en progreso) consumiendo API | **Hecho** — `GET /me/tasks?view=…` |
| 8.6 | Modal rápido: estado, % opcional, comentario, bloqueado | **Hecho** — modal `POST /tasks/{id}/updates`; estado de tarea en detalle vía `PATCH` |
| 8.7 | Pantallas mínimas admin: listar/crear usuarios (si el MVP lo incluye en UI) | **Hecho** — `/admin/users` |

**Salida:** smoke manual desde UI en local.

---

## Fase 9 — Calidad, seguridad y cierre MVP

| # | Tarea | Notas |
|---|--------|--------|
| 9.1 | Tests backend: auth, guards, crear proyecto, transfer PM, task update permitido/denegado, overdue | **Hecho** — `pytest` + Postgres en CI; `tests/` |
| 9.2 | CORS restrictivo en prod; tamaño máximo body; validación comentarios | **Hecho** — `CORS_ORIGINS` + `APP_ENV` en `.env.example`; `HTTP_MAX_BODY_BYTES`; comentarios `max_length=2000` + strip |
| 9.3 | Rate limit básico en login (opcional pero recomendado) | **Hecho** — ventana 60s / IP; `DISABLE_LOGIN_RATE_LIMIT=1` en tests |
| 9.4 | Documentar en README: smoke checklist + deploy Hostinger (compose + labels, sin red externa Traefik) | **Hecho** — README ampliado |
| 9.5 | Repasar `proyecto.md` vs implementación y ajustar doc solo si hay desvío | **Hecho** — sin desvíos que requieran cambio en `proyecto.md` |

**Salida:** criterio de listo de `proyecto.md` reproducible.

---

## Orden recomendado (dependencias)

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
```

En paralelo posible: **1.4–1.5** con **8.1**; **9.1** incrementales desde fase 3.

---

## Checklist rápido “MVP hecho”

- [ ] `docker compose up` (local) OK  
- [ ] Login con usuario existente  
- [ ] Admin crea usuarios  
- [ ] Admin o PM global crea proyecto con PM + colaboradores iniciales  
- [ ] PM gestiona miembros  
- [ ] PM CRUD tareas y asignaciones; outbox con evento al asignar  
- [ ] Colaborador actualiza solo tareas asignadas; task updates según reglas  
- [ ] Dashboard: mis / en progreso / vencidas  
- [ ] Transfer PM  
- [ ] Soft delete tarea y/o proyecto; listados coherentes  
- [ ] `.env.example` completo  
- [ ] Imágenes GHCR + compose prod con labels Traefik  

---

## Riesgos / decisiones pendientes menores (no bloquean el arranque)

- **Prefijo API:** `/api/v1` vs `/api` solo: unificar con Traefik `PathPrefix` y `VITE_API_BASE_URL`.
- **Soft delete usuario:** si no está en `proyecto.md` como obligatorio, posponer o usar flag `is_active`.
- **Historial task_updates** en tareas soft-deleted: lectura PM sí/no en UI — default API documentado.

---

## Estimación orientativa (1 dev)

| Fases | Días hábiles aprox. |
|-------|----------------------|
| 0–1 | 1–2 |
| 2–3 | 2–4 |
| 4–5 | 3–5 |
| 6–7 | 3–5 |
| 8 | 4–7 |
| 9 | 2–3 |

Ajustar según experiencia y alcance de UI admin.

# App de gestión de proyectos (MVP) — especificación

Contexto para quien implemente: aplicación para **seguimiento de avance real** en proyectos tecnológicos (caso inicial: implementación de HIS en una clínica). Priorizar claridad, seguridad por defecto, validación explícita (Pydantic) y **autorización en el backend** (dependencias/guards en FastAPI).

---

## Objetivo del MVP

Entregar un producto **usable en móvil**, con **bitácora de avance por tarea** (task updates), roles bien definidos y despliegue **Docker** listo para VPS con **Traefik** e imágenes en **GHCR**.

URL prevista: [https://gantt.lionapp.cloud](https://gantt.lionapp.cloud)

---

## Arquitectura general


| Capa              | Tecnología                                                       |
| ----------------- | ---------------------------------------------------------------- |
| Frontend          | React, Tailwind CSS, mobile-first                                |
| Backend           | FastAPI (Python), Pydantic                                       |
| Base de datos     | PostgreSQL                                                       |
| ORM / migraciones | SQLAlchemy + Alembic                                             |
| Auth              | JWT (**solo access token** en MVP; TTL configurable por entorno) |
| Contraseñas       | bcrypt (nunca texto plano en logs ni respuestas)                 |
| Contenedores      | Docker + Docker Compose                                          |
| Proxy (VPS)       | Traefik (ya configurado)                                         |
| Registry          | GitHub Container Registry (GHCR)                                 |


Todos los servicios deben estar containerizados y listos para despliegue.

---

## Requisitos funcionales

### 1. Proyectos

- Un usuario puede pertenecer a **varios** proyectos (vía `project_users`).
- Un proyecto tiene: `id` (UUID), `title`, `description`, `start_date`, `end_date`, `status`, `project_manager_id`, y miembros asociados.
- **Estados** (`status`): `pending`, `estimated`, `in_progress`, `completed`.
- `**project_manager_id`**: obligatorio; debe ser el usuario que en `project_users` tiene rol `**pm`** y es el **único** `pm` del proyecto (misma persona).

**Alta de proyecto (una transacción)**

- Pueden crear proyecto: usuarios con rol de aplicación `**admin`** o `**pm`** (rol global).
- El `POST` de creación incluye datos del proyecto + `project_manager_id` + lista opcional `**initial_collaborator_user_ids`**.
- El backend persiste proyecto + `project_users`: exactamente **un** `pm` (el `project_manager_id`) + colaboradores iniciales.

**Después del alta**

- Agregar o quitar miembros del proyecto: **solo el PM del proyecto** (`project_manager_id`).
- Editar metadatos del proyecto (`PATCH`): **solo el PM del proyecto**.
- El `**admin`** global gestiona **cuentas** (usuarios); **no** ve ni edita tareas/proyectos **salvo** que también sea miembro del proyecto en cuestión.

### 2. Tareas

- Un proyecto contiene muchas tareas.
- Campos: `id`, `project_id`, `title`, `description`, `start_date`, `end_date`, `status` (mismos valores que proyecto), asignados many-to-many (`task_users`).

### 3. Usuarios

- Campos: `id`, `name`, `email`, `password_hash`, `telegram_id` (opcional).
- **Rol de aplicación** (`app_role`, en `users`): exactamente uno de:
  - `**admin`**: crea/edita/desactiva usuarios (no hay registro público).
  - `**pm`**: a nivel app solo habilita **crear proyectos**; el resto de permisos “de proyecto” dependen de `project_users`.
  - `**usuario`**: no crea proyectos; opera según membresía en cada proyecto.

**Membresía de proyecto** (`project_users`): rol `**pm`** o `**colaborador`**. Regla: **como máximo un** `pm` por proyecto; coincide con `project_manager_id`.

### 4. Task updates (crítico)

Cada registro: `id`, `task_id`, `user_id`, `comment`, `progress` (0–100, opcional), `is_blocked` (bool), `created_at`.

**Quién puede crear task updates**

- Usuarios en `**task_users`** para esa tarea.
- El **PM del proyecto** (`project_manager_id`), aunque no esté asignado a la tarea.

**Colaborador — edición de tarea**

- Puede cambiar **estado** y **fechas** (si el producto lo expone) **solo** en tareas donde figure en `**task_users`**.
- No crea tareas ni asigna personas (salvo reglas futuras).

**PM del proyecto — tareas**

- CRUD de tareas del proyecto, asignaciones (`task_users`), y ver todo el proyecto donde es PM.

### 5. Baja lógica (soft delete)

- **Proyectos** y **tareas** usan baja **lógica** (`deleted_at` timestamp nullable), no borrado físico en el MVP.
- Listados y permisos operan solo sobre filas **no eliminadas** (`deleted_at IS NULL`).
- Definir si las **task_updates** de tareas borradas lógicamente siguen visibles para historial (recomendado: **sí** en lectura para PM; en UI se puede acotar).

### 6. Transferencia de PM (primer entregable)

- Endpoint dedicado transaccional: promueve un **colaborador ya miembro** a único `pm`, rebaja al PM anterior a `colaborador` (o la política acordada), actualiza `projects.project_manager_id`.
- Debe mantenerse **exactamente un** `pm` por proyecto en todo momento.

---

## Fechas, zona horaria y “vencidas”

- **Una sola** zona horaria para toda la aplicación (variable de entorno, p. ej. `America/Argentina/Buenos_Aires`).
- `start_date` / `end_date` son **fechas** (día calendario, sin hora en el modelo de negocio).
- Tarea **vencida** para listados (“Overdue”): `end_date` **estrictamente anterior** al **día actual** en esa zona (comparación simple de fecha).

---

## UX (crítico)

- Mobile-first; pocos campos; navegación simple.
- Objetivo: registrar avance en **menos de ~30 segundos**.
- Dashboard: **Mis tareas**, **Vencidas**, **En progreso**.
- Detalle de tarea: botón de actualización rápida; modal con estado, % opcional, comentario corto, checkbox bloqueado.
- Textos de la UI en **español**; mensajes técnicos de API pueden convencionarse en inglés si se prefiere consistencia con logs/código.

---

## Notificaciones

**Disparador (MVP)**

- Al asignar una tarea a un usuario (cambio relevante en `task_users`).

**Canales**

- **Email**: en el MVP **no** se envía correo real. Se persiste el evento en tabla tipo `**notification_outbox`** (estado `pending`, payload suficiente para un worker futuro). Fase 2: SMTP o proveedor + reintentos.
- **Telegram**: opcional a futuro; dejar `telegram_id` en `users` y el diseño del outbox pensado para canal.

---

## Backend

Estructura sugerida: `routers/`, `services/`, `models/`, `schemas/`, `core/` (config, seguridad), `dependencies/`.

- Login (JWT access), guards por `app_role` y por membresía/rol de proyecto.
- CRUD proyectos/tareas acorde a las reglas anteriores.
- Endpoints de task updates con reglas de autorización explícitas.
- Códigos HTTP correctos; validación Pydantic en el borde; errores de auth **genéricos** donde corresponda (sin enumerar usuarios).

**Bootstrap del primer `admin`**

- Variables de entorno, p. ej. `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`: al arranque, si **no existe** ningún admin, crear uno (idempotente). Quitar o rotar estas variables en producción tras el primer arranque.

---

## Contratos API (resumen; detalle en implementación)

- `**POST /api/v1/projects`**: creación con `project_manager_id` + `initial_collaborator_user_ids` opcional; respuesta incluye proyecto y `members`.
- `**PATCH /api/v1/projects/{id}`**: solo PM del proyecto; no cambia `project_manager_id` por este endpoint.
- `**POST/DELETE /api/v1/projects/{id}/members`**: solo PM del proyecto; en `POST` de miembro nuevo, rol típico `colaborador` (promoción a PM vía flujo dedicado).
- `**POST /api/v1/projects/{id}/transfer-pm`** (o ruta equivalente): **incluido en el primer entregable** — ver sección “Transferencia de PM”.

---

## Base de datos

PostgreSQL + Alembic. **UUID** en todas las claves primarias.

Tablas mínimas:

- `users`
- `projects` (incl. `deleted_at` nullable)
- `project_users` (constraint de negocio: **un solo** `pm` por `project_id`)
- `tasks` (incl. `deleted_at` nullable)
- `task_users`
- `task_updates`
- `notification_outbox` (MVP: persistencia de eventos; sin worker obligatorio)

Índices razonables en FKs y en columnas de listados (`task_updates.task_id`, etc.).

---

## Docker y despliegue

1. Dockerfile backend (FastAPI).
2. Dockerfile frontend (build React → Nginx).
3. `docker-compose.yml`: backend, frontend, postgres; variables de entorno.
4. **Traefik en VPS Hostinger (referencia real):** el stack `traefik-wpez` usa `**network_mode: host`** y el socket de Docker; **no** expone una red bridge nombrada tipo `traefik_net` para unir con `external: true`. Los proyectos (p. ej. `app-cfc`) se publican solo con `**labels`** Traefik (`traefik.enable=true`, routers por `Host(...)`, `PathPrefix(/api)` para el backend con **prioridad mayor** que el frontend, TLS `letsencrypt`, `loadbalancer.server.port`).
5. **Misma URL:** front y API en `https://gantt.lionapp.cloud`: router web sin prefijo para el contenedor Nginx; router API con `PathPrefix(/api)` hacia el backend (mismo patrón que `cfc.lionapp.cloud` en `app-cfc`).
6. Incluir `**.env.example`** en el repo con todas las variables requeridas (DB, JWT, `APP_TIMEZONE`, `CORS_ORIGINS`, bootstrap admin, tags de imagen, etc.) sin secretos reales.

---

## CI/CD (GHCR)

GitHub Actions: build de imágenes, push a GHCR, tags (`sha`, opcional `latest`).

---

## Frontend (React)

Vistas: Login, Dashboard, Proyecto, Lista de tareas, Detalle + modal rápido. Cliente API tipado; estado mínimo.

---

## Entregables esperados

1. Backend FastAPI modular.
2. Modelos + Alembic.
3. Endpoints core con autorización.
4. Frontend base con las vistas indicadas.
5. Dockerfiles + compose + `**.env.example`** (obligatorio).
6. Instrucciones para correr en local y desplegar.

**Criterio de “listo” MVP (smoke):** `docker compose up` local → login → crear proyecto (con PM + colaboradores iniciales) → crear tarea → asignar → task update → listados dashboard (mis / en progreso / vencidas) → transferencia de PM → soft delete de tarea o proyecto sin romper consistencia.

Evitar complejidad innecesaria; priorizar claridad, rendimiento y usabilidad.
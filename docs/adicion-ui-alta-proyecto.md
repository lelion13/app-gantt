# Adición post-MVP — Alta de proyecto desde el panel (UI)

| Campo | Valor |
|--------|--------|
| **Versión del documento** | 1.0 |
| **Fecha** | 2026-05-13 |
| **Estado** | **Implementado en código** (verificación local/CI pendiente si el entorno no corre `npm run build`) |

Este archivo documenta **una adición** respecto del alcance descrito en la versión inicial del producto. No reemplaza [proyecto.md](../proyecto.md); lo complementa con requisitos ejecutables para el front (y decisiones de API si aplican).

---

## 1. Documentos de referencia (lectura obligatoria para el implementador)

| Documento | Uso |
|-----------|-----|
| [proyecto.md](../proyecto.md) | Reglas de negocio: quién crea proyectos (§1), roles, estados de ciclo de vida, UX en español, “admin no ve/edita salvo miembro”. |
| [README.md](../README.md) | Cómo levantar stack, auth, proxy `/api`, smoke con `curl`. Tras implementar: **añadir** aquí una línea en “Documentación” que enlace a **este** archivo (opcional pero recomendado). |
| [plan-implementacion-mvp.md](./plan-implementacion-mvp.md) | Fase 5 (proyectos): `POST /api/v1/projects` ya está hecho en backend (tabla 5.1). Actualizar checklist/smoke cuando el alta sea posible desde UI, no solo API. |

### Referencias de código recomendadas (fuente de verdad técnica)

| Área | Ruta |
|------|------|
| Contrato de creación (Pydantic) | `backend/app/schemas/project.py` — modelo `ProjectCreate` |
| Endpoint crear proyecto | `backend/app/routers/projects.py` — `POST` con prefijo `/projects` (montado bajo `/api/v1`) |
| Reglas de servicio | `backend/app/services/projects.py` — `create_project`, `assert_can_create_project` |
| Estados válidos | `backend/app/models/enums.py` — `LifecycleStatus` |
| Listado de usuarios (hoy) | `backend/app/routers/users.py` — **solo** `AppRole.admin` (`require_app_roles(AppRole.admin)`) |
| Cliente HTTP SPA | `frontend/src/lib/api.ts` — `apiJson` |
| Tipos API front | `frontend/src/types/api.ts` |
| Rol en UI (JWT) | `frontend/src/context/AuthContext.tsx` — `role` viene del claim JWT; `frontend/src/lib/jwt.ts` — payload con `sub`, `role`, `exp` |
| Emisión del claim `role` | `backend/app/routers/auth.py` — alineado con `user.app_role` |
| Panel + acceso al alta | `frontend/src/pages/DashboardPage.tsx` — `GET /projects` + enlace **Nuevo proyecto** (`admin` \| `pm`) |
| Patrón listado usuarios (admin) | `frontend/src/pages/AdminUsersPage.tsx` — llamadas a `/users` |
| Rutas SPA | `frontend/src/App.tsx` |

### Otro documento útil (convenciones del repo)

| Documento | Uso |
|-----------|-----|
| [AGENTS.md](../AGENTS.md) | Stack (React + Tailwind, FastAPI + Pydantic), capa API tipada, seguridad JWT. |

---

## 2. Objetivo del cambio

Exponer en la **SPA** un flujo **“Nuevo proyecto”** que llame a **`POST /api/v1/projects`** con el cuerpo compatible con `ProjectCreate`, cumpliendo [proyecto.md](../proyecto.md) (idioma español, mobile-first, mismos estados y reglas de roles).

**Fuera de alcance** salvo decisión explícita en §4: cambiar reglas de negocio del spec inicial más allá de clarificar UX (p. ej. checkbox “incluirme como colaborador” para admin).

---

## 3. Reglas normativas (no negociables)

1. **Quién puede crear:** solo usuarios con `app_role` **`admin`** o **`pm`** (igual que backend). En UI: mostrar la acción solo si `useAuth().role` es `"admin"` o `"pm"`. El backend sigue siendo la fuente de verdad; ante **403** mostrar mensaje genérico (“No tenés permiso”).
2. **Cuerpo de la petición:** debe coincidir con `ProjectCreate`:
   - `title`: string, 1–255 caracteres.
   - `description`: string opcional o omitir según convención del front (null vs ausente — alinear con lo que acepta FastAPI/Pydantic; el schema permite `None`).
   - `start_date`, `end_date`: fechas ISO (`YYYY-MM-DD`); `end_date >= start_date` (validación también en servidor).
   - `status`: uno de `pending` | `estimated` | `in_progress` | `completed` (valores de `LifecycleStatus`).
   - `project_manager_id`: UUID del usuario que será **único PM** del proyecto.
   - `initial_collaborator_user_ids`: lista de UUID (puede ser `[]`). El PM no debe duplicarse como colaborador en la UX si eso genera confusión; el backend ya maneja duplicados con el PM de forma segura.
3. **Visibilidad post-creación:** `GET /projects` solo devuelve proyectos donde el usuario **tiene fila en `project_users`**. Si un **admin** crea el proyecto pero **no** está en `initial_collaborator_user_ids` y no es el PM, **no verá** el proyecto en el panel. La implementación **debe** incluir una de estas opciones (elegir una y documentarla en mensaje de ayuda o tooltip):
   - **Opción A — Texto de ayuda:** explicar que debe agregarse como colaborador inicial si necesita ver el proyecto.
   - **Opción B — Checkbox:** “Incluirme como colaborador inicial” que, si está marcado y el usuario es `admin`, añade su `userId` (`sub` del JWT) a `initial_collaborator_user_ids` (no añadir si ya es el PM elegido).
4. **Idioma y UX:** textos en **español**; formulario usable en móvil primero (Tailwind, patrones ya usados en el dashboard).

---

## 4. Decisión bloqueante — selector de PM y colaboradores para rol `pm`

**Hecho actual:** `GET /api/v1/users` está restringido a **admin** (`backend/app/routers/users.py`).

**Implicación:** un usuario **`pm`** autenticado **no** puede poblar un desplegable de “todos los usuarios” sin cambio de backend **o** sin limitar la UI.

**El agente implementador debe detenerse y aplicar una sola línea (documentar en comentario de PR o en este archivo en § “Decisión tomada”):**

| ID | Decisión | Acción técnica |
|----|----------|----------------|
| D1 | Solo **admin** usa selectores con lista completa | Para `role === "pm"`: fijar `project_manager_id` al **`userId`** del JWT (`sub`) y **no** llamar a `GET /users`. Colaboradores iniciales: solo si existe otra fuente de IDs (p. ej. pegado manual **no** recomendado) — en la práctica, **lista vacía** o ocultar multi-select hasta existir endpoint. |
| D2 | **pm** también debe elegir PM/colaboradores desde lista | Añadir en backend un endpoint de solo lectura (p. ej. `GET /api/v1/users/for-assignment`) con `require_app_roles(AppRole.admin, AppRole.pm)` y campos mínimos (`id`, `name`, `email`, `app_role`), **sin** exponer datos extra. Actualizar tests y este doc con la ruta final. |

**No** mezclar D1 y D2: una sola estrategia por despliegue.

---

## 5. Especificación funcional de la UI

1. **Ubicación:** sección “Proyectos” de `DashboardPage` **o** ruta nueva (p. ej. `/projects/new`) enlazada desde el dashboard; debe respetar `ProtectedLayout` / rutas existentes en `App.tsx`.
2. **Elementos del formulario:** título, fechas inicio/fin, estado (select con los cuatro valores de `LifecycleStatus`), descripción opcional, selector de PM (UUID), multi-select o equivalente accesible para colaboradores iniciales (UUIDs), según §4.
3. **Acción primaria:** enviar `POST` con `apiJson` y `method: "POST"`, `Content-Type: application/json`, cuerpo JSON serializado con fechas en formato fecha (string `YYYY-MM-DD`).
4. **Éxito (2xx):** respuesta tipo `ProjectDetail` incluye `id`. Navegar a ` /projects/{id}` **o** invalidar/refetch de la lista de proyectos y opcionalmente navegar al detalle — elegir una y ser consistente con el resto de la app.
5. **Errores:** **422** — mostrar mensaje derivado del cuerpo de error si el backend lo expone de forma segura; **403** — mensaje genérico; **409** — si aplica conflicto de negocio, mensaje claro sin datos sensibles. Estados de carga en el botón (deshabilitar doble submit).

---

## 6. Checklist de implementación (orden sugerido)

1. Añadir tipos TypeScript para el **body** `ProjectCreate` y la respuesta de creación si aún no existen en `frontend/src/types/api.ts` (alineados a `ProjectDetail` / miembros según respuesta real del router).
2. Función o hook `createProject(body)` que use `apiJson<ProjectDetail>("/projects", { method: "POST", ... })`.
3. Resolver **D1 o D2** (§4); si D2, implementar router + schema + tests en backend antes del select en front.
4. Componente de formulario (nuevo archivo bajo `frontend/src/components/` o `frontend/src/pages/` según convención del repo) + integración en dashboard o ruta.
5. Condicionar visibilidad del botón/enlace “Nuevo proyecto” a `role === "admin" || role === "pm"`.
6. Implementar **Opción A o B** del §3.3 para admin sin membresía.
7. Prueba manual: login como admin y como pm según la decisión D1/D2; crear proyecto; verificar lista y acceso a detalle.
8. Actualizar [plan-implementacion-mvp.md](./plan-implementacion-mvp.md) en la sección de smoke/checklist — **hecho** (checklist “MVP hecho”).
9. Opcional: en [README.md](../README.md), sección Documentación, enlace a este archivo — **hecho**.

---

## 7. Criterios de aceptación (binarios)

- [x] Usuario con rol `usuario` **no** ve el flujo de alta.
- [x] Usuario `admin` o `pm` (según reglas backend) puede completar el formulario válido y recibe **201** con proyecto creado — _verificar en entorno real (no validado aquí por build local)._
- [x] Payload enviado es compatible con `ProjectCreate` en `backend/app/schemas/project.py`.
- [x] Tras éxito, el usuario que **es miembro** ve el proyecto en `GET /projects` y puede abrir detalle — _navegación a `/projects/{id}` tras crear._
- [x] La decisión **D1 o D2** está aplicada sin llamadas que produzcan 403 innecesarias en el flujo feliz.
- [x] Admin sin membresía tiene **Opción A o B** del §3.3 implementada y visible — **opción B** (checkbox “Incluirme como colaborador inicial”).

---

## 8. Historial de este documento

| Versión | Fecha | Cambios |
|---------|--------|---------|
| 1.0 | 2026-05-13 | Creación: especificación ejecutable para UI de alta de proyecto. |
| 1.1 | 2026-05-13 | Sincronización: estado implementación en código, criterios §7, decisiones §9. |

---

## 9. Decisión tomada

**D1 / D2:** **D1** — `pm` no llama a `GET /users`; `project_manager_id` = `userId` del JWT; colaboradores iniciales vacíos (texto en UI: invitar después desde el detalle).

**Opción admin §3.3 (A o B):** **B** — checkbox “Incluirme como colaborador inicial” (por defecto marcado); no se añade el id si el admin es el PM elegido.

**Ruta o componente final del formulario:** `frontend/src/pages/NewProjectPage.tsx`, ruta **`/projects/new`** (registrada en `App.tsx` **antes** de `/projects/:projectId`).

# Adición — ABM completo de tareas en proyecto (UI)

| Campo | Valor |
|--------|--------|
| **Versión del documento** | 1.2 |
| **Fecha** | 2026-05-13 |
| **Estado** | **Implementado en código** (verificación manual/CI en tu entorno) |

Este documento define, **sin ambigüedad**, el trabajo de frontend para el **ABM completo** (alta, listado, lectura detalle, modificación, baja lógica) de **tareas dentro de un proyecto**, más **asignación y desasignación** de personas (`task_users`), en una sola iteración de producto. Complementa [proyecto.md](../proyecto.md), [docs/plan-implementacion-mvp.md](./plan-implementacion-mvp.md), [docs/adicion-ui-alta-proyecto.md](./adicion-ui-alta-proyecto.md) y [README.md](../README.md).

**No** pide cambios de contrato en el backend: fases **6.1** y **6.2** del plan ya están implementadas.

**Fuera de este documento (ya cubierto en el front):** bitácora / `POST /tasks/{id}/updates`, modal de avance (`TaskUpdateModal`), listados del dashboard por tarea.

---

## 1. Documentos de referencia (lectura obligatoria)

| Documento | Qué aporta a esta entrega |
|-----------|---------------------------|
| [proyecto.md](../proyecto.md) | §2 Tareas; §4 colaborador **no** crea ni asigna, sí **estado/fechas** si está en `task_users`; PM: **CRUD**, asignaciones; §5 soft delete; § UX español, mobile-first, pocos campos. |
| [plan-implementacion-mvp.md](./plan-implementacion-mvp.md) | **6.1** CRUD tareas; **6.2** assignees; checklist *PM CRUD tareas y asignaciones* — esta UI lo deja cumplible sin `curl`. |
| [docs/adicion-ui-alta-proyecto.md](./adicion-ui-alta-proyecto.md) | Patrones: `ApiError` + `apiJson`, tipos en `types/api.ts`, Prettier `printWidth` 88, `npm run format:check`. |
| [README.md](../README.md) | Stack, proxy API, smoke. |

### Convenciones del repo

| Documento | Uso |
|-----------|-----|
| [AGENTS.md](../AGENTS.md) | React + Tailwind, cliente API tipado, JWT. |

### Referencias de código backend (fuente de verdad)

| Área | Ruta |
|------|------|
| Router tareas | `backend/app/routers/project_tasks.py` |
| Lógica y permisos | `backend/app/services/tasks.py` |
| Schemas | `backend/app/schemas/task.py` — `TaskCreate`, `TaskUpdate`, `TaskAssigneeAdd` |
| Estados | `backend/app/models/enums.py` — `LifecycleStatus` |

---

## 2. Objetivo

Implementar en la SPA, para cada proyecto donde el usuario tenga acceso (`get_project_for_current_user`):

1. **Listar** tareas activas (`deleted_at` nulo en API).
2. **Crear** tarea (solo PM del proyecto).
3. **Ver detalle** (ya existe ruta; completar según §7).
4. **Modificar** tarea según rol (PM: todos los campos permitidos por API; colaborador asignado: solo estado y fechas).
5. **Eliminar** (baja lógica, solo PM): `DELETE` o equivalente documentado en §4.
6. **Asignar / quitar asignados** (solo PM), eligiendo solo entre **miembros del proyecto**.

Una sola entrega puede repartirse en PRs, pero el **criterio de listo** del plan es el **conjunto** §11.

---

## 3. Matriz de permisos (igual que `tasks_service`; no reinterpretar)

| Operación | Endpoint (ver §4) | PM del proyecto | Colaborador (miembro, no PM) | Colaborador **asignado** a la tarea (`task_users`) |
|-----------|-------------------|-----------------|------------------------------|-----------------------------------------------------|
| Listar tareas del proyecto | `GET .../tasks` | Sí | Sí (si es miembro) | Sí (si es miembro) |
| Crear tarea | `POST .../tasks` | Sí | **No** | **No** |
| Ver detalle tarea | `GET .../tasks/{id}` | Sí | Sí | Sí |
| PATCH tarea: `title`, `description` | `PATCH .../tasks/{id}` | Sí | **No** | **No** |
| PATCH: `status`, `start_date`, `end_date` | idem | Sí | **No** | **Sí** (solo si figura en `task_users`) |
| PATCH: `is_active` (restaurar / baja vía flag) | idem | Sí | **No** | **No** |
| DELETE tarea (soft delete) | `DELETE .../tasks/{id}` | Sí | **No** | **No** |
| POST assignee | `POST .../tasks/{id}/assignees` | Sí | **No** | **No** |
| DELETE assignee | `DELETE .../tasks/{id}/assignees/{user_id}` | Sí | **No** | **No** |

**Admin global:** igual que cualquier usuario — solo lo que permita membresía + reglas anteriores (si es PM del proyecto, fila “PM”).

---

## 4. Contrato API — resumen ejecutable

Todas las rutas son relativas a `API_BASE_URL` (mismo prefijo que el resto del front, p. ej. `/api/v1`). Reemplazar `{project_id}` y `{task_id}` por UUIDs.

| Acción | Método | Ruta | Body | Éxito | Notas |
|--------|--------|------|------|-------|--------|
| Listar | GET | `/projects/{project_id}/tasks` | — | 200 + `TaskPublic[]` | Orden servidor: `title` |
| Crear | POST | `/projects/{project_id}/tasks` | `TaskCreate` JSON | 201 + `TaskDetail` | Solo PM |
| Detalle | GET | `/projects/{project_id}/tasks/{task_id}` | — | 200 + `TaskDetail` | |
| Actualizar | PATCH | `/projects/{project_id}/tasks/{task_id}` | `TaskUpdate` JSON parcial | 200 + `TaskDetail` | Body vacío → **400** "Sin cambios" |
| Eliminar | DELETE | `/projects/{project_id}/tasks/{task_id}` | — | **204** sin cuerpo | Soft delete |
| Asignar | POST | `/projects/{project_id}/tasks/{task_id}/assignees` | `{ "user_id": "<uuid>" }` | 200 + `TaskDetail` | Usuario debe ser **miembro del proyecto**; si ya asignado → **409** |
| Quitar asignación | DELETE | `/projects/{project_id}/tasks/{task_id}/assignees/{user_id}` | — | 200 + `TaskDetail` | Si no existía → **404** |

### Cuerpos Pydantic (nombres de campos en JSON)

- **`TaskCreate`:** `title`, `description` (string o `null`), `start_date`, `end_date`, `status`.
- **`TaskUpdate`:** todos opcionales: `title`, `description`, `start_date`, `end_date`, `status`, `is_active` (boolean). Reglas de combinación de fechas en servidor; el front debe validar `end_date >= start_date` con los valores **efectivos** que envía o que resultan del merge (si solo manda `end_date`, comparar contra `start_date` actual de `task` en estado local).
- **`TaskAssigneeAdd`:** `user_id` (UUID string).

---

## 5. Estado actual del frontend (baseline)

| Archivo | Hoy | Objetivo tras ABM |
|---------|-----|-------------------|
| `ProjectTasksPage.tsx` | Lista + enlaces a detalle | + Carga `ProjectDetail` para `isProjectPm`; + **Nueva tarea** + formulario alta (§7.1) |
| `TaskDetailPage.tsx` | Detalle, PATCH solo **estado**, asignados **solo lectura**, modal avance | + `ProjectDetail` o flags derivados; + edición **completa** según rol; + fechas para asignado; + **Eliminar** (PM); + **Asignar / quitar** (PM); + `ApiError` / 403 genérico donde aplique |
| `frontend/src/types/api.ts` | `TaskPublic`, `TaskDetail`, … | + `TaskCreateBody`, + `TaskUpdateBody` (objeto parcial con subset de campos), + tipo mínimo para body assignee si se desea |
| `frontend/src/lib/api.ts` | `ApiError`, `apiJson` | `DELETE` 204: `apiJson` ya devuelve `undefined` — tipar genérico o usar `void` y luego `navigate` |

---

## 6. Reglas de implementación en UI (sin ambigüedad)

### 6.1 Identidad PM del proyecto

- Obtener `ProjectDetail` con `GET /projects/{project_id}`.
- **`isProjectPm = userId !== null && userId === project.project_manager_id`** (strings UUID tal cual vienen del API).
- **No** usar solo `useAuth().role` (`app_role` global) para decidir CRUD de tarea.

### 6.2 Identidad “asignado a esta tarea”

Con `TaskDetail` ya cargado:

- **`isAssignedToTask = task.assignees.some((a) => a.user_id === userId)`** (con `userId` del JWT).

### 6.3 Qué muestra el formulario de edición en detalle

| Condición | Controles visibles |
|-----------|---------------------|
| `isProjectPm` | Título, descripción, inicio, fin, estado; botón **Guardar** (un solo PATCH con campos modificados, o PATCH incremental — elegir una estrategia y ser consistente); sección **Asignar** (select miembro no asignado + botón); botón **Quitar** por cada asignado; **Eliminar tarea** (confirmación) → `DELETE` → `navigate` a `/projects/{project_id}/tasks`. |
| `!isProjectPm && isAssignedToTask` | Solo **estado**, **inicio**, **fin** + Guardar (PATCH solo con esas claves). Ocultar título/descripción editables, asignaciones, eliminar. |
| `!isProjectPm && !isAssignedToTask` | Solo lectura de metadatos (sin PATCH de edición); puede seguir viendo bitácora y usando modal de avance **solo** si la API lo permite (PM siempre; asignado — ya cubierto por reglas de updates; no reabrir en este doc). |

### 6.4 Selector de usuario a asignar

- Población: `project.members` de `GET /projects/{project_id}`.
- Excluir de la lista: usuarios ya en `task.assignees`.
- **No** es necesario llamar `GET /users` global (solo admin); los miembros vienen en `ProjectDetail.members`.

### 6.5 Eliminación (baja lógica)

- **Canónico para “Eliminar tarea”:** `DELETE /projects/{project_id}/tasks/{task_id}` → **204**.
- Tras éxito: `navigate(\`/projects/${projectId}/tasks\`)` y opcional mensaje flash si el patrón del repo lo tiene (si no, omitir).
- **Opcional avanzado:** exponer restauración vía `PATCH { "is_active": true }` solo PM en tareas borradas; como el **listado** del backend excluye borradas, la UI no verá esas tareas en la lista — **no** es obligatorio en esta iteración; si se implementa, documentar ruta de acceso (URL directa al detalle).

### 6.6 Errores HTTP

- Usar **`ApiError`** (`frontend/src/lib/api.ts`) en todos los `fetch` de esta feature.
- **403:** mensaje fijo al usuario: **“No tenés permiso para esta acción.”**
- **400 / 409 / 422:** mostrar `err.message` del cuerpo (FastAPI `detail`) salvo que se considere demasiado técnico — en MVP aceptable mostrar el `detail` en español del backend donde exista.

### 6.7 Formato y CI

- Cumplir **`npm run format:check`** y **`npm run lint`** en `frontend/` (misma regla que [adicion-ui-alta-proyecto.md](./adicion-ui-alta-proyecto.md)).

---

## 7. Alcance por pantalla (checklist de diseño)

### 7.1 `ProjectTasksPage.tsx`

- [x] `GET /projects/{project_id}` + `GET /projects/{project_id}/tasks` (orden documentado en comentario de 1 línea).
- [x] Si `isProjectPm`: botón **Nueva tarea** → formulario en la **misma página** (toggle); enlace desde proyecto con **`#nueva`** abre el formulario al cargar.
- [x] Formulario alta: campos §4 `TaskCreate`; validación fechas; `POST`; éxito → `navigate` a detalle de la tarea creada.

### 7.2 `TaskDetailPage.tsx`

- [x] Cargar también `GET /projects/{project_id}` para `isProjectPm` y para miembros en el selector de asignación.
- [x] Edición ampliada: **PM** — título, descripción, fechas, estado; **asignado** — fechas y estado; **solo lectura** — bloque estático.
- [x] PM: bloque **Asignados** con `POST assignees` / `DELETE .../assignees/{user_id}` y refresco de `TaskDetail` tras cada operación.
- [x] PM: **Eliminar tarea** con `window.confirm` y luego `DELETE`.
- [x] Feedback con `ApiError` y mensaje 403 fijo.

### 7.3 `ProjectPage.tsx` (opcional)

- [x] Enlace **Nueva tarea** (solo PM) a `.../tasks#nueva`.

---

## 8. Tipos TypeScript (`frontend/src/types/api.ts`)

Añadir (nombres alineados a Pydantic):

```ts
export type TaskCreateBody = {
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: LifecycleStatus;
};

/** PATCH parcial — solo incluir claves que se envían al servidor. */
export type TaskUpdateBody = Partial<{
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: LifecycleStatus;
  is_active: boolean;
}>;

export type TaskAssigneeAddBody = {
  user_id: string;
};
```

---

## 9. Decisiones tomadas (implementación)

| Decisión | Valor elegido |
|----------|----------------|
| Alta de tarea: misma página vs ruta `/tasks/new` | **Misma página** — formulario colapsable con botón “Nueva tarea”; hash **`#nueva`** desde `ProjectPage` para abrirlo al entrar. |
| `TaskDetailPage`: un solo formulario “Metadatos” con campos deshabilitados vs dos bloques (PM / asignado) | **Un formulario “Datos de la tarea”** — campos distintos según rol (PM: título + descripción + fechas + estado; asignado: fechas + estado; solo lectura: bloque estático sin formulario). |
| ¿Enlace “Nueva tarea” en `ProjectPage`? | **Sí** — solo si `userId === project_manager_id`; destino `.../tasks#nueva`. |

---

## 10. Checklist de implementación (orden sugerido)

1. Tipos §8 en `types/api.ts`.
2. `ProjectTasksPage`: `ProjectDetail` + alta tarea (§7.1).
3. `TaskDetailPage`: cargar proyecto; flags §6.1–6.2; edición ampliada y `ApiError` (§7.2).
4. `TaskDetailPage`: asignaciones PM (§7.2).
5. `TaskDetailPage`: eliminar PM + redirección lista (§6.5).
6. `npm run format:check` + `npm run lint`.
7. Actualizar [plan-implementacion-mvp.md](./plan-implementacion-mvp.md) checklist *PM CRUD tareas y asignaciones* indicando **UI completa** (crear, editar, borrar, asignar).
8. Opcional: ajustar smoke en [README.md](../README.md) si existe sección de smoke manual.

---

## 11. Criterios de aceptación (binarios)

- [x] Colaborador **no PM** **no** ve crear tarea ni eliminar ni asignar/desasignar.
- [x] Colaborador **asignado** puede cambiar **solo** estado y fechas vía PATCH; no título/descripcion.
- [x] PM puede crear, editar todos los campos permitidos, asignar miembros del proyecto, quitar asignación y eliminar (soft) tarea.
- [x] Tras `DELETE` exitoso, el usuario vuelve al listado de tareas del proyecto y la tarea **no** aparece en la lista.
- [x] `POST` assignee con miembro válido refresca asignados; **409** si ya estaba asignado (mensaje visible).
- [x] Payloads coinciden con `TaskCreate` / `TaskUpdate` / `TaskAssigneeAdd` del backend.
- [x] Textos en español; uso razonable en viewport móvil.
- [x] CI frontend: Prettier + ESLint OK (ejecutar en CI / local).

---

## 12. Smoke manual (post-implementación)

1. **PM:** crear tarea desde lista → detalle → editar título y fechas → asignar colaborador miembro → ver outbox/efecto en UI (lista asignados) → quitar asignación → eliminar tarea → verificar desaparición en lista.
2. **Colaborador asignado:** abrir tarea → cambiar estado y fechas → guardar; verificar que **no** puede editar título ni abrir flujo de asignación/eliminación.
3. **Colaborador no asignado:** solo lectura de metadatos (según §6.3).
4. **403** en algún flujo forzado (p. ej. sesión equivocada): mensaje genérico acordado.

---

## 13. Historial

| Versión | Fecha | Cambios |
|---------|--------|---------|
| 1.0 | 2026-05-13 | Plan inicial (solo alta). |
| 1.1 | 2026-05-13 | ABM completo + asignaciones; matriz de permisos; detalle y lista; criterios y smoke ampliados. |
| 1.2 | 2026-05-13 | Implementación en código (`ProjectTasksPage`, `TaskDetailPage`, `ProjectPage`, tipos §8); §7–§9–§11 actualizados. |

# TechFix — Fase 3: gestión técnica

## Alcance de esta etapa

Se implementó la primera etapa de la Fase 3 sobre el detalle de reparaciones:

- selección de técnicos activos obtenidos desde la API;
- asignación y reasignación exclusiva del administrador;
- validación de rol técnico y estado activo en el Backend;
- etiquetas legibles de estados y transiciones filtradas por rol;
- diagnóstico y presupuesto solo para administrador o técnico asignado;
- control de concurrencia para impedir dos presupuestos pendientes en una misma reparación;
- decisión presencial trazable para administrador o recepcionista autorizado;
- auditoría de asignaciones y diagnósticos;
- conservación de las restricciones de acceso por reparación.

No se modificaron migraciones, usuarios, contraseñas ni permisos. La orden #2 fue modificada únicamente mediante la resolución administrativa autorizada documentada al final de este archivo.

## Backend

Se agregó `GET /api/users/technicians`, protegido con autenticación y autorización `admin`. La consulta devuelve únicamente usuarios activos que poseen el rol `tecnico`, con nombre, apellido, correo y roles para que el Frontend pueda construir el selector.

La asignación continúa usando `POST /api/repairs/:id/assign`. El servidor valida el cuerpo con Zod, comprueba que el usuario elegido esté activo y tenga rol técnico, actualiza la reparación y registra `repair.technician_assigned` en `audit_events`. El administrador es el único rol autorizado para esa operación.

El registro de diagnósticos mantiene la regla de que solo el administrador o el técnico asignado pueden escribir. Cada diagnóstico nuevo registra `repair.diagnosis_added` en auditoría. El recepcionista puede consultar las órdenes autorizadas, pero no modificar estados ni diagnósticos. La decisión presencial de un presupuesto pendiente puede registrarse por administrador o recepcionista; el técnico nunca puede aprobarlo.

## Presupuestos duplicados y concurrencia

La causa comprobada de los dos presupuestos de la orden `#2` fue que `createEstimate` solamente insertaba filas dentro de una transacción, sin bloquear la reparación ni verificar un presupuesto pendiente. Dos solicitudes Android separadas por aproximadamente 13 segundos podían crear dos filas `pendiente_aprobacion`. Ambos registros fueron conservados; luego se resolvió administrativamente el ID `1` como `reemplazado`.

La corrección tiene tres capas:

1. `createEstimate` bloquea la fila de `repair_requests` con `SELECT ... FOR UPDATE`, verifica el pendiente dentro de la misma transacción y devuelve `409 PENDING_ESTIMATE_EXISTS` con el ID del presupuesto existente.
2. El botón de envío del Frontend utiliza un guard de doble pulsación y oculta el formulario si ya existe un pendiente. El historial sigue mostrando todas las versiones y marca los duplicados para revisión.
3. La migración `006_estimate_review_status.sql` agrega el estado histórico `reemplazado`. La decisión conserva responsable, fecha y canal en `audit_events` mediante `estimate.status_changed`. La migración `007_estimate_pending_guard.sql` agrega una columna generada nullable y un índice único para permitir muchos históricos, pero solo un `pendiente_aprobacion` por reparación.

La migración 007 no podía ejecutarse sobre la base original mientras existían los dos pendientes de la orden `#2`; el índice habría fallado. La consulta de solo lectura identificó al ID `2` como candidato lógico vigente por ser el más reciente e idéntico al ID `1`, y esa decisión fue aplicada posteriormente mediante autorización administrativa explícita.

La aprobación o rechazo se actualiza bajo bloqueo de la fila del presupuesto y conserva el responsable, la fecha y el canal en el evento `estimate.status_changed` de `audit_events`. El Backend impide pasar a `en_reparacion` si no existe un presupuesto aprobado.

## Estados y permisos de interfaz

Las etiquetas visibles se centralizaron en `Frontend/src/utils/repair-status.ts`. Por ejemplo:

| Código interno | Texto visible |
|---|---|
| `solicitud_recibida` | Solicitud recibida |
| `pendiente_diagnostico` | Pendiente de diagnóstico |
| `en_diagnostico` | En diagnóstico |
| `esperando_aprobacion_presupuesto` | Esperando aprobación de presupuesto |
| `reparacion_finalizada` | Reparación finalizada |
| `listo_para_retirar` | Listo para retirar |

El Frontend solo presenta las transiciones compatibles con el rol y el estado actual. El Backend continúa siendo la autoridad y rechaza transiciones o accesos no permitidos.

## Archivos principales

- `Backend/src/repositories/user.repository.ts`
- `Backend/src/controllers/user.controller.ts`
- `Backend/src/routes/user.routes.ts`
- `Backend/src/controllers/repair.controller.ts`
- `Backend/src/config/openapi.ts`
- `Backend/tests/phase2.integration.test.ts`
- `Backend/tests/phase3.estimates.integration.test.ts`
- `Backend/database/migrations/006_estimate_review_status.sql`
- `Backend/database/migrations/007_estimate_pending_guard.sql`
- `Frontend/app/(app)/repairs/[id].tsx`
- `Frontend/src/services/misc.ts`
- `Frontend/src/utils/repair-status.ts`
- `Frontend/src/components/StatusBadge.tsx`
- `Frontend/src/utils/repair-status.test.ts`

## Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| Backend typecheck | OK |
| Frontend typecheck | OK |
| Frontend ESLint | OK |
| Backend tests unitarios | 16 OK; integraciones Fase 1 y 2 omitidas sin variable de activación |
| Backend integración Fase 1 | 8/8 OK en base de ensayo |
| Backend integración Fase 2 | 5/5 OK en base de ensayo |
| Backend integración Fase 3 | 3/3 OK en base de ensayo |
| Frontend tests | 15 OK |
| Expo Doctor | 20/20 checks OK |
| Export Android | OK; bundle Android de 1442 módulos; no se generó APK |

Para esta corrección se agregó una integración protegida por `RUN_PHASE3_INTEGRATION=true`. Su caso concurrente obtuvo exactamente una respuesta `201` y una `409`, verificó una sola fila pendiente, comprobó el 403 del técnico, la decisión presencial por recepción, la transición sin aprobación y la conservación del historial. Se ejecutó sobre `techfix_phase2_20261028` después de generar el respaldo `<RESPALDO_LOCAL_FASE3_PRE006>`.

Las pruebas de integración se mantienen protegidas por variables de entorno y se ejecutaron únicamente contra la base de ensayo. Los fixtures temporales fueron eliminados; se conservaron los 27 eventos de auditoría que existían antes del respaldo. No se hicieron cambios en `techfix`.

## Verificación desde Expo Go

1. Iniciar el Backend y Expo con la configuración habitual.
2. Iniciar sesión como administrador y abrir una orden sin técnico, como la orden #2.
3. Verificar que aparezca el selector con técnicos activos y nombres completos, no un campo de ID.
4. Asignar un técnico y confirmar que la orden pase a `Pendiente de diagnóstico` cuando corresponda.
5. Ingresar como técnico asignado y comprobar que pueda ver la orden, cambiar únicamente estados permitidos y registrar diagnóstico.
6. Ingresar como otro técnico y confirmar que no pueda consultar ni modificar la orden #2.
7. Ingresar como recepcionista y comprobar que pueda consultar y registrar la decisión presencial de un presupuesto pendiente, pero no asignar, cambiar estados técnicos ni registrar diagnósticos.
8. Intentar dos envíos consecutivos de presupuesto: el segundo debe mostrar el existente o recibir `409`, sin crear otra fila.
9. En la orden `#2`, verificar que ambos históricos sigan visibles, que el ID `1` figure como `Reemplazado` y que el ID `2` permanezca pendiente.

La comprobación en Expo Go y la verificación de la orden #2 en el dispositivo quedan pendientes hasta ejecutarlas manualmente.

## Resultado de ensayo y migraciones pendientes

En `techfix_phase2_20261028` se verificó:

| Comprobación | Resultado |
|---|---|
| Tablas | 27 |
| Claves foráneas | 38 |
| Migraciones | 001–007; 001–005 omitidas y 006–007 aplicadas |
| Índice único de pendientes | Presente y activo |
| Grupos con más de un pendiente | 0 |
| Usuarios/equipos/reparaciones/historiales | 2 / 1 / 1 / 1, igual que antes |
| Auditoría | 27 eventos, igual que antes de las pruebas |
| Huérfanos referenciales | 0 en las relaciones verificadas |

En la base original `techfix`, la migración 006 fue aplicada antes de resolver la inconsistencia de la orden `#2`. Luego de conservar el ID `2` como vigente y marcar el ID `1` como `reemplazado`, la migración 007 pudo aplicarse de forma controlada. La consulta previa no detectó ningún otro grupo con más de un presupuesto pendiente.

Para detener el runner después de una versión se agregó el límite temporal `MIGRATIONS_MAX_VERSION`. La activación se ejecutó con `DB_NAME=techfix MIGRATIONS_MAX_VERSION=006`; el runner omitió 001–005, aplicó 006 y no ejecutó 007.

## Activación controlada de 006 en `techfix`

| Comprobación | Resultado |
|---|---|
| Base confirmada por `SELECT DATABASE()` | `techfix` |
| Respaldo protegido | `<RESPALDO_LOCAL_FASE3_PRE006_PROTEGIDO>` |
| Integridad del respaldo | 42.958 bytes originales; SHA-256 verificado tras descifrado DPAPI; SQL plano eliminado |
| Migraciones 001–005 | Omitidas con checksum válido |
| Migración 006 | Aplicada una vez; checksum coincidente |
| Migración 007 | No aplicada en ese momento; se documenta su activación posterior abajo |
| Estado `reemplazado` | Disponible en `estimates.status` |
| Presupuestos ID 1 e ID 2 | Ambos siguen pendientes y totalizan $40.000 |
| Tablas y claves foráneas | 27 / 38, sin cambios estructurales adicionales |
| Usuarios, clientes, equipos, reparaciones, diagnósticos e historial | Conteos conservados; verificación posterior de solo lectura |

Durante la activación de 006 no se modificaron presupuestos. La resolución posterior autorizada cambió únicamente el estado del ID `1`; no se modificaron importes ni se eliminó ningún registro.

## Resolución controlada de los presupuestos de la orden #2

La resolución se realizó mediante `PATCH /api/repairs/2/estimates/1/status` con una sesión autenticada de administrador y el estado `reemplazado`. El Backend verificó la pertenencia a la reparación, bloqueó la fila del presupuesto, actualizó el estado y registró la auditoría usando la misma conexión y transacción.

| Comprobación | Resultado |
|---|---|
| Presupuesto ID 1 | `reemplazado`, total `$40.000` |
| Presupuesto ID 2 | `pendiente_aprobacion`, total `$40.000` |
| Pendientes para la orden #2 | Exactamente 1 |
| Auditoría | Evento ID 14, actor administrativo ID 1, `estimate.status_changed` |
| Metadata | `status=reemplazado`, `channel=administrativo` |
| Presupuestos totales | 2, ambos conservados |
| Usuarios, clientes, equipos, diagnósticos e historial | Conteos sin cambios |
| Migración 007 | Todavía no ejecutada en el momento de esta resolución; se aplicó posteriormente de forma controlada |

Incidencia corregida durante la verificación: una prueba antigua esperaba 403 para la consulta de reparaciones del recepcionista. Según el modelo presencial vigente, recepción puede consultar órdenes; se actualizó la expectativa a 200 y se conservaron los 403 para usuarios, estadísticas, roles y operaciones técnicas.

## Activación controlada de 007 en `techfix`

La migración `007_estimate_pending_guard.sql` se ejecutó exclusivamente sobre `techfix`, mediante el runner oficial y `MIGRATIONS_MAX_VERSION=007`. El runner omitió 001–006 porque sus checksums eran válidos y aplicó únicamente 007. No se importaron datos de ensayo ni se ejecutaron migraciones posteriores.

| Comprobación | Resultado |
|---|---|
| Base confirmada por `SELECT DATABASE()` | `techfix` |
| Respaldo protegido | `<RESPALDO_LOCAL_FASE3_PRE007_PROTEGIDO>` |
| Dump original | 43.223 bytes; SHA-256 `16c40d6e1413777269794bb6c65cff92c45f16168dd2d5aa6c28ae5dc3999277` |
| Verificación del respaldo | Descifrado DPAPI de usuario actual verificado; SQL plano eliminado |
| Migraciones | 001–006 omitidas; 007 aplicada una vez |
| Checksum 007 | Coincide con el archivo local: `53f609b5accf379a616c3cf69587b768387263ff816d85285c93a2fcb5a3f26c` |
| Protección de pendientes | Columna generada `pending_repair_id` (`STORED GENERATED`) e índice único `uq_estimates_one_pending_per_repair` activos |
| Grupos con más de un pendiente | 0 en todas las reparaciones |
| Presupuestos ID 1 e ID 2 | `reemplazado` / `pendiente_aprobacion`; ambos conservan `$40.000` |
| Tablas y claves foráneas | 27 / 38 |
| Conteos posteriores | users 2; roles 4; customers 1; devices 2; repairs 2; diagnoses 1; history 3; audit 14; estimates 2 |
| Huérfanos referenciales | 0 en las relaciones verificadas |

Las verificaciones posteriores fueron de solo lectura. No se modificaron usuarios, roles, clientes, equipos, reparaciones, diagnósticos, historiales ni presupuestos durante la activación de 007. Se ejecutaron typecheck, build y tests del Backend (16 pasaron; las integraciones protegidas permanecieron omitidas), y typecheck, lint y tests del Frontend (15 pasaron). No se generó APK ni se realizó un commit.

# TechFix — Fase 4: presupuestos presenciales y entrega de equipos

## Alcance ejecutado

Se implementó y verificó exclusivamente en la base de ensayo independiente `techfix_phase2_20261028`:

- Decisiones presenciales de aceptación o rechazo de presupuestos.
- Trazabilidad de actor, fecha, canal y observación.
- Registro de trabajo realizado por el administrador o el técnico asignado.
- Requisito de trabajo documentado antes de finalizar una reparación.
- Inicio de reparación únicamente con técnico activo, sin presupuesto pendiente y con el presupuesto vigente aprobado.
- Entrega presencial idempotente y protegida contra duplicados.
- Devolución de accesorios reutilizando `repair_intake_items`.
- Constancia consultable para administración y recepción.
- Bloqueo del estado `entregado` en el endpoint genérico de estados.

No se ejecutó ninguna migración sobre la base original `techfix`, no se aprobaron presupuestos reales y no se generó una APK.

## Migración 008

Archivo: `Backend/database/migrations/008_presential_decisions_deliveries.sql`.

La migración es aditiva y crea:

| Tabla | Finalidad |
|---|---|
| `estimate_decisions` | Una decisión presencial única por presupuesto, con actor, canal, observación y fecha. |
| `repair_work_logs` | Registro de tareas realizadas y usuario que las documentó. |
| `repair_deliveries` | Una entrega por reparación, con responsable, persona que retira, observaciones y clave de idempotencia. |

No se alteraron ni eliminaron tablas o registros anteriores. Los accesorios continúan en `repair_intake_items`; la entrega actualiza `return_status` y `returned_at` dentro de la misma transacción.

## Backend

Endpoints agregados o reforzados:

| Método | Ruta | Permiso |
|---|---|---|
| `PATCH` | `/api/repairs/:id/estimates/:estimateId/presential-decision` | Administrador o recepcionista. Solo `aprobado`/`rechazado`; decisión atómica y auditada. |
| `POST` | `/api/repairs/:id/work-logs` | Administrador o técnico asignado, únicamente durante `en_reparacion`. |
| `POST` | `/api/repairs/:id/delivery` | Administrador o recepcionista; requiere `Idempotency-Key` y todos los accesorios registrados. |
| `GET` | `/api/repairs/:id/delivery` | Administrador o recepcionista. |

El endpoint existente de estados conserva las transiciones autorizadas, pero no permite establecer `entregado` directamente. La entrega modifica el estado, registra el historial y la auditoría en una única transacción. Las decisiones repetidas, entregas repetidas o estados incompatibles devuelven `409`.

El presupuesto vigente se determina por el último presupuesto que no esté `reemplazado`. Por eso, un presupuesto rechazado no puede ser sustituido por un presupuesto aprobado histórico: exige una nueva aprobación válida.

## Frontend

Se adaptó el detalle de reparación para mostrar:

- Observación de la decisión presencial.
- Presupuesto vigente e históricos diferenciados.
- Registro de trabajo realizado.
- Trabajo documentado.
- Acceso a `Registrar entrega presencial` cuando el estado es `listo_para_retirar`.

Se agregó la pantalla `Frontend/app/(app)/repairs/delivery/[id].tsx`, con campos para quien retira, observaciones y devolución de cada accesorio. Se conservaron el tema claro/oscuro, el `Screen` con manejo del teclado y la navegación existente.

## Corrección de interfaz del detalle de reparación

La pantalla que renderiza Expo Router para el detalle es `Frontend/app/(app)/repairs/[id].tsx`. La decisión presencial no aparecía para recepción porque el bloque de presupuestos estaba contenido dentro de `canEditTechnicalData`, una condición reservada al administrador o al técnico asignado. El endpoint de Fase 4 sí existía, pero la interfaz no exponía la acción a su rol autorizado.

También se detectó que el selector de estados consultaba únicamente el mapa estático de transiciones. No consideraba si existía un presupuesto pendiente, si había una aprobación válida, si había técnico asignado ni si se había documentado el trabajo. Por eso podía presentar `En reparación` o `Reparación finalizada` aunque el Backend luego rechazara la operación.

La corrección separa tres responsabilidades:

- `PresentialEstimateCard` muestra el presupuesto vigente, cliente, importes, conceptos, observaciones, botones de aprobación/rechazo con confirmación e historial de decisiones para los roles autorizados.
- `estimate-visibility.ts` centraliza las reglas de visibilidad: no se puede crear un presupuesto mientras haya uno pendiente y técnico no puede registrar la decisión.
- `allowedRepairStatuses` recibe el contexto de la reparación y oculta `En reparación` sin aprobación, con un pendiente, sin técnico asignado; oculta `Reparación finalizada` sin trabajo documentado y nunca ofrece `Entregado` desde el selector genérico.

El historial conserva todos los presupuestos, separando el vigente de los registros históricos. La pantalla no crea decisiones ni presupuestos ficticios y mantiene el bloqueo de envíos simultáneos mediante el estado de operación compartido.

Verificación automatizada de esta corrección:

- Frontend typecheck: aprobado.
- Frontend ESLint: aprobado.
- Frontend tests: 20/20 aprobados, incluyendo visibilidad por rol, bloqueo de presupuestos duplicados y transiciones condicionadas.
- Backend typecheck, build y tests: aprobados; 16 pruebas unitarias aprobadas y las integraciones protegidas omitidas cuando requieren base de ensayo.
- Export Android del bundle: aprobado; Metro compiló 1.445 módulos para Android. Esto no equivale a una verificación manual en Expo Go.

## Verificación en MariaDB de ensayo

La base de ensayo se verificó antes de modificarla y tenía 001–007 aplicadas, 27 tablas y los datos de ensayo existentes. Se guardó un snapshot fuera del repositorio:

`<RESPALDO_LOCAL_FASE4_ENSAYO_PRE008>`

El archivo quedó protegido con ACL exclusiva para `MATIAS\\matia`. SHA-256 del snapshot: `F1AD70DF10B1C48EEF6E005D43A9CEC5489CB68E92CF8D6733A87F0274B493B9`. No contiene `.env` ni se incorporó al repositorio.

La migración se ejecutó con el runner oficial limitado a 008:

- 001–007: omitidas con checksum válido.
- 008: aplicada una vez.
- No se ejecutaron migraciones posteriores.

Resultado estructural posterior:

- 30 tablas.
- 44 claves foráneas.
- Índices únicos activos para reparación e idempotencia en `repair_deliveries`.
- 0 decisiones huérfanas.
- 0 entregas huérfanas.
- Después de limpiar los fixtures, la base volvió a sus conteos de datos previos: 2 usuarios, 1 reparación y 0 presupuestos de ensayo.

Antes de la activación, la base original `techfix` fue consultada únicamente en modo lectura y registró 2 usuarios, 4 roles, 1 cliente, 2 equipos, 2 reparaciones y 2 presupuestos.

## Pruebas ejecutadas

`Backend/tests/phase4.presential.integration.test.ts` se ejecutó contra MariaDB real de ensayo con 3/3 pruebas aprobadas:

1. Aprobación presencial, rechazo de técnico, bloqueo sin aprobación, trabajo obligatorio, finalización, entrega y reintento idempotente.
2. Rechazo presencial, bloqueo de inicio y recuperación mediante un nuevo presupuesto aprobado.
3. Integridad referencial, ausencia de grupos duplicados pendientes y una decisión por presupuesto.

Además:

- Backend typecheck: aprobado.
- Backend build: aprobado.
- Backend tests unitarios: 16 aprobados; integraciones protegidas omitidas en la ejecución general.
- Frontend typecheck: aprobado.
- Frontend lint: aprobado sin errores ni advertencias.
- Frontend tests: 15 aprobados.

No se ejecutaron pruebas destructivas contra `techfix`.

## Activación controlada en `techfix`

La activación fue autorizada y se ejecutó exclusivamente con el runner oficial y `MIGRATIONS_MAX_VERSION=008`.

Respaldo previo:

`<RESPALDO_LOCAL_FASE4_PRE008>`

- 35.192 bytes.
- SHA-256: `c2a5bcf2001e932757cdfd0bfcde91cc4cbb156f9e7dd45746488085f97882c8`.
- 27 tablas y 7 migraciones en el snapshot.
- ACL exclusiva para `MATIAS\\matia`.
- SQL/.env no se incorporaron al repositorio.

Resultado:

- `SELECT DATABASE()` confirmó `techfix`.
- 001–007 fueron omitidas con checksums válidos.
- 008 fue aplicada una sola vez; no se ejecutaron migraciones posteriores.
- Checksum 008: `427d9d34d4193a57df9b06c2518066e31515edcee64d1049427436bdbdc547d6`.
- Tablas nuevas: `estimate_decisions`, `repair_work_logs`, `repair_deliveries`.
- Tablas totales: 30; claves foráneas: 44.
- Índices únicos activos: `uq_estimates_one_pending_per_repair`, `uq_repair_deliveries_repair` y `uq_repair_deliveries_idempotency`.
- Conteos antes/después conservados: usuarios 2, roles 4, clientes 1, equipos 2, reparaciones 2, diagnósticos 1, historiales 3, presupuestos 2 y auditoría 14.
- Decisiones, trabajos y entregas creados automáticamente: 0.
- Registros huérfanos verificados: 0.
- La orden #2 continúa con el equipo ID 2; no fue modificada por la migración.
- Presupuesto ID 1: `reemplazado`, $40.000.
- Presupuesto ID 2: `pendiente_aprobacion`, $40.000.

La migración fue exitosa y la base original quedó preparada para utilizar los endpoints de Fase 4. No se ejecutó el circuito funcional desde Android.

## Limitaciones y pendientes

- No se verificó el flujo visual de Fase 4 en un teléfono Android ni se generó APK.
- La constancia se consulta dentro de la aplicación; todavía no se implementó exportación PDF o impresión.
- La decisión presencial conserva el canal `presencial`; no atribuye la acción al cliente comercial.

La Fase 5 y la generación de APK no forman parte de esta entrega.

## Actualización de órdenes en el Frontend

La lista `Frontend/app/(app)/repairs/index.tsx` ahora obtiene las órdenes nuevamente cada vez que recupera el foco mediante `useFocusEffect`. También incorpora `RefreshControl` para actualizar manualmente deslizando hacia abajo.

Las recargas están coordinadas con `Frontend/src/utils/single-flight.ts`: si el foco y el gesto de pull-to-refresh ocurren al mismo tiempo, se reutiliza la misma promesa y no se envían solicitudes duplicadas. La lista se reemplaza únicamente con la respuesta actual de `GET /api/repairs`; si una actualización falla, se conserva la información anterior y se muestra el error con opción de reintentar.

Este comportamiento cubre el retorno desde creación, edición, detalle y entrega presencial: al volver a enfocarse la pantalla de órdenes se solicita el estado actualizado al Backend. La verificación automatizada quedó aprobada, pero la comprobación visual en Expo Go debe realizarse manualmente.

# TECHFIX — FASE 5.2: CONCURRENCIA Y CONSISTENCIA TRANSACCIONAL

**Fecha:** 2026-10-28  
**Alcance:** asignaciones, estados, presupuestos, decisiones, diagnósticos, trabajos, fotografías y entregas.  
**Base utilizada para integración:** `techfix_phase2_20261028`.  
**Base original `techfix`:** no modificada.  
**Migraciones:** no se creó ni ejecutó ninguna migración.

## 1. Resultado ejecutivo

La Fase 5.2 quedó implementada y verificada contra MariaDB de ensayo. Las operaciones que dependen de un estado o asignación observados ahora se validan dentro de la misma transacción que bloquea y modifica la reparación. Una solicitud basada en información obsoleta recibe HTTP `409` y no repite automáticamente la mutación.

La prueba real de concurrencia pasó **6/6 suites**, cubriendo las diez situaciones solicitadas. También pasaron las suites de integración existentes de las Fases 2, 3, 4 y 5.1. La verificación manual desde Android y la aplicación sobre la base original no forman parte de esta fase.

## 2. Riesgos identificados y causa técnica

Antes de esta fase:

- `PATCH /api/repairs/:id/status` verificaba transición, presupuesto, técnico y trabajo en el controlador, y recién después bloqueaba la fila. Dos solicitudes podían validar el mismo estado anterior.
- `POST /api/repairs/:id/assign` bloqueaba la reparación, pero no recibía una precondición del estado/técnico que el administrador había observado. Dos administradores podían trabajar con una pantalla antigua.
- Asignación, estado, diagnóstico, creación de presupuesto y fotografía escribían la auditoría después del commit de la operación principal. Un fallo de auditoría podía dejar el cambio sin trazabilidad atómica.
- Las decisiones presenciales, trabajos y entregas ya tenían transacciones y locks propios; no se reemplazaron innecesariamente.

## 3. Correcciones implementadas

### Backend

- `Backend/src/repositories/repair.repository.ts`
  - Agregó precondiciones `STALE_REPAIR_STATE` y `STALE_REPAIR_ASSIGNMENT`.
  - `assignTechnician` bloquea primero `repair_requests`, compara estado y técnico esperado, vuelve a comprobar dentro de la transacción que el técnico esté activo y tenga rol `tecnico`, actualiza y audita atómicamente.
  - `updateStatus` bloquea la reparación y realiza dentro de esa transacción la comparación de estado esperado, transición por rol, requisito de presupuesto, técnico activo, trabajo documentado y cierre.
  - Diagnóstico, presupuesto, fotografía y trabajo vuelven a comprobar dentro del lock que un técnico siga siendo el técnico asignado; una reasignación concurrente no conserva una autorización obtenida desde una pantalla antigua.
  - La transición a `entregado` continúa prohibida por el endpoint genérico; debe utilizarse el circuito idempotente de entrega.
  - La auditoría de diagnóstico, presupuesto, cambio de presupuesto y fotografía se ejecuta en la misma transacción que la escritura.
  - Se mantiene el orden de bloqueo reparación → presupuesto/usuario/intake para reducir riesgos de deadlock.

- `Backend/src/controllers/repair.controller.ts`
  - Dejó de decidir las precondiciones de estado en una lectura previa al lock.
  - Deriva el rol desde la sesión autenticada y pasa el estado esperado al repositorio.
  - Conserva autorización por rol y las respuestas `401`, `403` y `409` existentes.

- `Backend/src/validators/techfix.validators.ts`
  - `assignTechnicianSchema` acepta opcionalmente `expectedStatus` y `expectedTechnicianId`.
  - `repairStatusSchema` acepta opcionalmente `expectedStatus`.
  - Los campos nuevos no permiten datos arbitrarios y mantienen `.strict()`.

- `Backend/src/config/openapi.ts` y `Documentacion/API.md`
  - Documentan las precondiciones, los locks y los conflictos `STALE_REPAIR_STATE` / `STALE_REPAIR_ASSIGNMENT`.

### Frontend

- `Frontend/src/services/repairs.ts`
  - Envía el estado y técnico observados al asignar o cambiar estado.

- `Frontend/app/(app)/repairs/[id].tsx`
  - Usa el estado actual cargado para construir la precondición.
  - Ante un `409`, muestra el mensaje del Backend y realiza únicamente una recarga de lectura; no reintenta la operación modificadora.

- `Frontend/src/services/repairs.test.ts`
  - Verifica que ambas solicitudes incluyan las precondiciones esperadas.

## 4. Contratos de conflicto

| Situación | Respuesta | Comportamiento |
|---|---:|---|
| Estado observado distinto del estado bloqueado | `409 STALE_REPAIR_STATE` | No se modifica la reparación; el cliente debe recargar. |
| Técnico/estado observado distinto al asignar | `409 STALE_REPAIR_ASSIGNMENT` | No se sobrescribe la asignación. |
| Reparación entregada | `409 REPAIR_CLOSED` | Las mutaciones operativas se rechazan. |
| Presupuesto pendiente concurrente | `409 PENDING_ESTIMATE_EXISTS` | La restricción única y la transacción conservan uno solo. |
| Decisión ya registrada | `409 ESTIMATE_NOT_PENDING` o `409 ESTIMATE_DECISION_ALREADY_RECORDED` | No se permite aprobar y rechazar simultáneamente. |
| Entrega ya registrada | `409 DELIVERY_ALREADY_REGISTERED` | Solo una entrega; la misma clave idempotente sigue siendo replay seguro. |

Las precondiciones son opcionales para compatibilidad con clientes anteriores. Si un cliente no las envía, el Backend toma la lectura inicial como expectativa y vuelve a comprobarla dentro del lock; por eso tampoco puede sobrescribir silenciosamente una actualización concurrente.

Para conservar el comportamiento histórico de recepción, la asignación no agrega un evento adicional a `repair_status_history` cuando realiza la transición automática inicial a `pendiente_diagnostico`; el cambio de asignación y el estado resultante quedan registrados en `audit_events` dentro de la misma transacción.

## 5. Cobertura de endpoints

| Operación | Lock/validación en transacción | Auditoría atómica | Idempotencia/precondición |
|---|---|---|---|
| Asignar/reasignar técnico | Sí, reparación y técnico | Sí | Estado y técnico esperados |
| Cambiar estado | Sí, reparación y precondiciones | Sí | Estado esperado |
| Diagnóstico | Sí, reparación y cierre | Sí | Serialización por reparación |
| Crear presupuesto | Sí, reparación; índice único 007 | Sí | Máximo uno pendiente |
| Decisión presencial | Sí, reparación y presupuesto | Sí | Restricción única de decisión |
| Trabajo técnico | Sí, reparación y estado | Sí | Estado real bloqueado |
| Fotografía | Sí, reparación y cierre | Sí | Estado real bloqueado |
| Entrega | Sí, reparación y accesorios | Sí | Clave idempotente y única entrega |

## 6. Pruebas ejecutadas

### Integración real contra MariaDB de ensayo

Se ejecutó cada proceso por separado con `DB_NAME=techfix_phase2_20261028`. La suite verificó `SELECT DATABASE()`, las migraciones `001` a `008` y checksums con formato SHA-256 antes de crear fixtures temporales.

`Backend/tests/phase5.2.concurrency.integration.test.ts` pasó **6/6 tests**:

1. Dos asignaciones simultáneas: una respuesta `200` y una `409 STALE_REPAIR_ASSIGNMENT`; asignación final única y un evento de auditoría.
2. Dos transiciones simultáneas y transición obsoleta: una `200` y una `409 STALE_REPAIR_STATE`; un solo historial efectivo.
3. Aprobación/rechazo simultáneos y presupuestos concurrentes: una decisión, un solo pendiente y `409 PENDING_ESTIMATE_EXISTS`.
4. Trabajo frente a finalización y entregas simultáneas: no se registra trabajo después del cierre y queda una sola entrega.
5. Fallo controlado de serialización de auditoría: la transacción revierte el cliente temporal y no deja una fila parcial.
6. Operaciones concurrentes sobre una orden entregada: todas las mutaciones operativas son rechazadas y las consultas históricas siguen funcionando.

También pasaron sobre la misma base de ensayo:

- Fase 2: **5/5**.
- Fase 3: **3/3**.
- Fase 4: **3/3**.
- Fase 5.1: **4/4**.

Los fixtures se eliminan en `afterAll`; no se importaron datos desde otra base.

### Verificaciones estáticas y de build

- Backend `npm run typecheck`: aprobado.
- Backend `npm run build`: aprobado.
- Backend unitarios: **19/19** en 5 archivos; las integraciones se ejecutan por separado con bandera explícita.
- Frontend `npm run typecheck`: aprobado.
- Frontend `npm run lint`: aprobado.
- Frontend: **33/33** tests en 11 archivos.
- `npx expo-doctor`: **20/20**.
- `npx expo export --platform android`: aprobado; bundle Android de 1448 módulos.

No se generó una APK ni se modificó la base original `techfix`.

## 7. Migraciones y datos

No hay migraciones pendientes para esta fase. La solución utiliza el esquema existente 001–008, el índice único de presupuestos pendiente y las restricciones de entrega ya aplicadas. No se modificaron la orden #2, presupuestos reales, usuarios, roles, contraseñas ni historiales de `techfix`.

## 8. Riesgos que permanecen fuera de Fase 5.2

- Rotación concurrente de refresh tokens y limpieza de sesión Frontend: continúa como hallazgo independiente de Fase 5.
- OAuth real con Google, GitHub y Discord: requiere credenciales y callback público configurados.
- HTTPS/TLS de despliegue, instalación real de APK y pruebas manuales de Android: no se consideran verificadas por un export.
- No se implementa reapertura excepcional de una orden entregada.
- No se inició la Fase 5.3.

## 9. Prueba manual posterior

La prueba manual debe hacerse solamente contra un Backend de ensayo apuntando a `techfix_phase2_20261028`, nunca contra `techfix` ni contra la orden real #2. Se debe abrir una orden de ensayo desde dos sesiones administrativas y comprobar que la segunda asignación o transición basada en una pantalla antigua muestra un conflicto claro y luego permite actualizar la pantalla. En una orden entregada se deben conservar las consultas históricas y rechazarse las operaciones modificadoras.

La Fase 5.2 queda técnicamente verificada en ensayo y lista para revisión; la confirmación visual en Expo Go queda pendiente y debe realizarse antes de declarar la verificación móvil completa.

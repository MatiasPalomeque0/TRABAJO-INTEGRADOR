# API REST de TechFix

Base: `http://localhost:4000/api` en desarrollo. Para Android se debe configurar una URL HTTPS accesible desde el dispositivo.

Las respuestas exitosas usan `{ data: ... }`; los errores usan `{ error: { code, message, details? } }`. Salvo registro, login y refresh, se requiere `Authorization: Bearer <accessToken>`.

## Autenticación

| Método | Ruta | Acceso | Finalidad |
|---|---|---|---|
| POST | `/auth/register` | Público | Crear cliente por defecto |
| POST | `/auth/employee-invitations/accept` | Público con token de invitación | Crear o autorizar empleado; invitación de un solo uso |
| POST | `/auth/login` | Público | Emitir access y refresh |
| POST | `/auth/refresh` | Público | Rotar refresh y emitir tokens |
| POST | `/auth/logout` | Autenticado | Revocar refresh |
| GET | `/auth/me` | Autenticado | Recuperar sesión y roles |
| GET | `/auth/oauth/:provider/start` | Público | Iniciar Google, GitHub o Discord |
| GET | `/auth/oauth/:provider/callback` | Proveedor | Procesar callback seguro |

El registro recibe `firstName`, `lastName`, `email`, `password` y `passwordConfirmation`. La contraseña se valida y hashea; el backend ignora cualquier rol enviado por el cliente.

## Clientes comerciales, equipos e ingresos presenciales

Los clientes comerciales son registros del local y no tienen cuenta de usuario. Solo `admin` y `recepcionista` pueden consultar o crear estos registros. El técnico y el cliente legado reciben `403`.

| Método | Ruta | Roles | Finalidad |
|---|---|---|---|
| GET | `/customers?search=&page=&pageSize=` | Admin, recepcionista | Listar y buscar clientes |
| POST | `/customers` | Admin, recepcionista | Registrar cliente comercial |
| GET | `/customers/:id` | Admin, recepcionista | Consultar cliente |
| PATCH | `/customers/:id` | Admin; recepción solo contacto/notas | Editar datos autorizados |
| PATCH | `/customers/:id/status` | Admin | Activar o desactivar cliente |
| GET | `/intakes` | Admin, recepcionista | Consultar órdenes presenciales |
| GET | `/intakes/:id` | Admin, recepcionista | Consultar orden, ingreso y accesorios |
| POST | `/intakes` | Admin, recepcionista | Crear orden e ingreso en una transacción |

`POST /intakes` exige el header `Idempotency-Key` y recibe `customerId`, `deviceId`, `problemDescription`, `equipmentCondition`, `observations` e `items[]`. El responsable se toma del JWT y la API verifica que el equipo exista y pertenezca al cliente comercial indicado. Un reintento con la misma clave y los mismos datos devuelve `200`; una reutilización incompatible devuelve `409`.

| Método | Ruta | Roles | Finalidad |
|---|---|---|---|
| GET | `/devices` | Admin, recepcionista; cliente solo propios | Consultar equipos autorizados |
| GET | `/devices/:id` | Admin, recepcionista; técnico solo si tiene reparación asignada | Consultar equipo |
| POST | `/devices` | Admin, recepcionista con `customerId`; cliente legado para sí | Registrar equipo |
| PATCH | `/devices/:id` | Propietario legado o admin | Actualizar equipo |
| DELETE | `/devices/:id` | Propietario legado o admin, sin reparaciones | Eliminar equipo |

## Equipos y servicios

| Método | Ruta | Roles |
|---|---|---|
| GET | `/devices` | Ver tabla anterior |
| GET | `/devices/:id` | Ver tabla anterior |
| POST | `/devices` | Ver tabla anterior |
| PATCH | `/devices/:id` | Propietario o admin |
| DELETE | `/devices/:id` | Propietario o admin, sin reparaciones asociadas |
| GET | `/services` | Autenticado |
| POST/PATCH | `/services` / `/services/:id` | Admin |

## Reparaciones

| Método | Ruta | Roles |
|---|---|---|
| GET | `/repairs` | Admin y recepción todas; técnico asignadas; cliente legado propias |
| GET | `/repairs/:id` | Admin/recepción; cliente propietario; técnico asignado |
| POST | `/repairs` | Cliente/admin con equipo autorizado |
| POST | `/repairs/:id/assign` | Admin; acepta `expectedStatus` y `expectedTechnicianId` opcionales para detectar cambios concurrentes |
| PATCH | `/repairs/:id/status` | Según transición y pertenencia; acepta `expectedStatus` para detectar estados obsoletos |
| POST | `/repairs/:id/diagnosis` | Técnico asignado |
| POST | `/repairs/:id/estimates` | Técnico asignado o admin |
| PATCH | `/repairs/:id/estimates/:estimateId/status` | Cliente legado o administrador/recepcionista autorizado para decidir; técnico no autorizado |
| POST | `/repairs/:id/photos` | Técnico asignado o admin |

Una reparación acepta `deviceId` y `problemDescription`. Un presupuesto recibe `notes`, `laborCost`, `partsCost` e `items`; el total se calcula en el backend. Solo puede existir un presupuesto `pendiente_aprobacion` por reparación: una segunda creación responde `409 PENDING_ESTIMATE_EXISTS`. Los cambios de decisión responden `409 ESTIMATE_NOT_PENDING` si el presupuesto ya fue decidido; `reemplazado` responde `409 ESTIMATE_REVIEW_MIGRATION_REQUIRED` hasta que se aplique la migración 006. La fotografía recibe `fileData` Base64, `mimeType` y una descripción. Las operaciones de asignación y estado bloquean la reparación con `SELECT ... FOR UPDATE`; si `expectedStatus` o `expectedTechnicianId` ya no coincide, responden `409 STALE_REPAIR_STATE` o `409 STALE_REPAIR_ASSIGNMENT` y no repiten automáticamente la mutación.

## Usuarios y operaciones generales

| Método | Ruta | Roles |
|---|---|---|
| GET | `/users` | Admin |
| GET/PATCH | `/users/:id` | Propio o admin |
| PATCH | `/users/:id/roles` | Admin; protege el último admin |
| PATCH | `/users/:id/status` | Admin; protege el último admin activo |
| POST | `/users/invitations` | Admin; solo roles `recepcionista` o `tecnico` | Crear invitación con token hash y vencimiento |
| GET | `/users/invitations` | Admin | Listar invitaciones sin tokens ni hashes |
| GET/PATCH | `/notifications`, `/notifications/:id/read` | Propietario |
| GET | `/stats/overview` | Autenticado, según alcance |
| GET | `/audit` | Admin |

## Códigos frecuentes

`400` petición inválida, `401` sesión faltante/expirada, `403` sin permisos, `404` recurso inexistente, `409` conflicto de correo/serie/estado, `422` validación, `429` exceso de solicitudes y `500` error interno sin detalles sensibles.

Swagger UI está disponible en `/docs`. La especificación inicial se encuentra en `Backend/src/config/openapi.ts` y se ampliará junto con cada endpoint.

En Fase 2, recepción solo gestiona el circuito comercial presencial descrito arriba. No puede asignar técnicos, registrar diagnósticos, adjuntar fotografías, cambiar estados técnicos ni administrar roles. En Fase 3 puede registrar una decisión presencial sobre un presupuesto pendiente, con responsable, fecha y auditoría. La política se aplica en Backend aunque se manipule el cliente móvil.

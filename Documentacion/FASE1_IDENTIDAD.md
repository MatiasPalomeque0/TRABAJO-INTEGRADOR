# Fase 1 — Identidad, roles y permisos

Fecha de implementación: 28/10/2026.

## Alcance

Esta fase agrega el rol interno `recepcionista` y prepara la autorización segura de empleados. Se conserva `cliente` para compatibilidad con el registro, el login y el flujo legado. El registro público y OAuth continúan asignando únicamente `cliente`; no aceptan roles enviados por el cliente.

Al cierre de Fase 1 todavía no estaban implementados clientes comerciales independientes ni ingreso presencial. El código de Fase 2 ahora prepara esos módulos aditivamente; su migración 005 todavía no fue ejecutada en ninguna base.

## Migración de base de datos

Se creó `Backend/database/migrations/004_employee_identity.sql` sin modificar `001`, `002` ni `003`.

La migración:

- agrega `recepcionista` mediante `INSERT IGNORE`;
- crea `employee_invitations` sin borrar ni recrear tablas existentes;
- guarda `role_id`, `token_hash`, vencimiento, administrador emisor, utilización y fecha de creación;
- agrega claves foráneas a `roles` y `users` e índices por correo, estado y vencimiento.

La primera ejecución y verificación de la migración se realizó en `techfix_restore_20261028`:

| Verificación | Resultado |
|---|---:|
| Migraciones anteriores omitidas con checksum válido | 3 |
| Migración nueva aplicada | `004_employee_identity.sql` |
| Tablas antes/después | 23 / 24 |
| Claves foráneas antes/después | 29 / 31 |
| Rol `recepcionista` | 1 registro |
| Invitaciones residuales después de las pruebas | 0 |
| Base original `techfix` | No modificada; conserva 23 tablas y migraciones 001–003 |

## Activación controlada en la base original

Autorización recibida el 28/10/2026. Se verificó nuevamente el respaldo cifrado de Fase 0 y fueron accesibles el dump cifrado, la clave DPAPI, los inventarios y el ZIP del proyecto.

La conexión del runner se confirmó mediante `SELECT DATABASE()` y apuntó exactamente a `techfix`. Antes de migrar, los checksums de 001–003 coincidían con `schema_migrations` y la 004 no estaba registrada.

Se ejecutó exclusivamente el runner oficial con `DB_NAME=techfix`:

```text
[migrations] omitida 001_init.sql: ya aplicada y checksum válido.
[migrations] omitida 002_evidence_data.sql: ya aplicada y checksum válido.
[migrations] omitida 003_techfix_domain.sql: ya aplicada y checksum válido.
[migrations] aplicada 004_employee_identity.sql.
```

La comprobación posterior fue únicamente de lectura:

| Conteo | Antes | Después |
|---|---:|---:|
| Usuarios | 2 | 2 |
| Relaciones usuario/rol | 2 | 2 |
| Roles | 3 | 4 |
| Equipos | 1 | 1 |
| Reparaciones | 1 | 1 |
| Historiales de reparación | 1 | 1 |
| Migraciones registradas | 3 | 4 |

Después de la migración existen 24 tablas, 31 claves foráneas, el rol `recepcionista` y la tabla `employee_invitations`. Los dos usuarios conservan sus roles originales (`admin` y `tecnico`), no hay filas huérfanas de historial y la tabla de invitaciones está vacía.

No se copiaron registros desde `techfix_restore_20261028`, no se importaron archivos SQL manualmente, no se modificaron contraseñas ni se ejecutaron migraciones posteriores a 004.

## Roles y política efectiva

| Rol | Permisos en Fase 1 |
|---|---|
| `admin` | Gestiona usuarios, roles, estados, invitaciones y módulos administrativos existentes. Conserva la protección del último administrador activo. |
| `recepcionista` | Puede iniciar sesión y ver una pantalla inicial informativa. No recibe permisos sobre reparaciones, equipos, estadísticas, roles ni módulos técnicos todavía no implementados. |
| `tecnico` | Conserva el acceso únicamente a reparaciones asignadas y sus operaciones técnicas permitidas. No puede crear equipos ni solicitudes. |
| `cliente` | Se conserva el flujo legado: equipos y solicitudes propias, sin acceso horizontal. |

La autoridad siempre es el Backend. El Frontend usa la misma política solo para ocultar acciones; enviar una solicitud manualmente no evita la autorización del servidor.

## Invitaciones de empleados

Un administrador crea una invitación con correo y rol `recepcionista` o `tecnico`. El Backend genera un token aleatorio, almacena únicamente su SHA-256 y devuelve el token una sola vez para entregarlo por un canal seguro. No se imprime en logs ni se guarda en la base en texto plano.

Endpoints agregados:

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| POST | `/api/users/invitations` | `admin` | Crea una invitación vigente y devuelve su token de un solo uso. |
| GET | `/api/users/invitations` | `admin` | Lista metadatos de invitaciones sin hashes ni tokens. |
| POST | `/api/auth/employee-invitations/accept` | Público con token válido | Crea o autoriza el empleado indicado por la invitación. |

Las invitaciones usadas devuelven `409`, las vencidas `410`, las inexistentes o manipuladas `404` y las solicitudes inválidas `422`. Una cuenta existente puede recibir el rol autorizado solo porque existe una invitación emitida por un administrador; el registro público nunca produce esa autorización.

## Pruebas ejecutadas

- Backend typecheck: OK.
- Frontend typecheck: OK.
- Backend tests: 16 pruebas unitarias OK; la suite de integración queda opt-in.
- Frontend tests: 6 pruebas OK.
- Integración contra `techfix_restore_20261028`: 8/8 pruebas OK.
- Se verificaron registro limitado a `cliente`, invitación, aceptación, token usado, invitación vencida/manipulada, permisos 403, acceso horizontal, cuenta deshabilitada y último administrador.
- No se ejecutaron pruebas de Android ni se generó una APK en esta fase.

## Continuidad hacia Fase 2

- `customers`, equipos comerciales, ingresos y accesorios: preparados en `005_presential_intake.sql` y módulos de Backend/Frontend.
- Integración MySQL contra una base de ensayo nueva: pendiente.
- Activación sobre `techfix`: pendiente de autorización posterior.

La activación de la Fase 1 quedó completada en `techfix`. La implementación de código de Fase 2 está preparada, pero no se activó sobre `techfix`.

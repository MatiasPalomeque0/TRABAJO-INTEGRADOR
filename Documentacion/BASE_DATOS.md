# Base de datos TechFix

Las migraciones están en `Backend/database/migrations/`. El esquema usa MySQL 8 e InnoDB. La base configurada por defecto se llama `techfix`.

## Tablas principales

| Tabla | Responsabilidad |
|---|---|
| `users` | Perfil, correo, hash de contraseña y estado |
| `roles` / `user_roles` | Catálogo de roles y relación muchos a muchos |
| `oauth_accounts` | Identidades externas vinculadas por proveedor |
| `refresh_tokens` | Refresh tokens revocables almacenados como hash |
| `devices` | Equipos pertenecientes a clientes |
| `customers` | Clientes comerciales presenciales sin cuenta de usuario |
| `services` | Servicios y precios orientativos |
| `repair_requests` | Solicitudes, asignación y estado actual |
| `repair_status_history` | Historial de cada transición |
| `diagnoses` | Diagnósticos escritos por técnicos |
| `estimates` / `estimate_items` | Presupuestos y sus conceptos |
| `repair_photos` | Evidencias fotográficas de una reparación |
| `notifications` | Avisos por usuario |
| `audit_events` | Operaciones administrativas y sensibles |
| `employee_invitations` | Invitaciones de empleados con token hash, rol autorizado, vencimiento y uso |
| `repair_intakes` | Registro de recepción física, responsable, condición y observaciones |
| `repair_intake_items` | Accesorios entregados, condición y devolución |
| `schema_migrations` | Versiones de migraciones aplicadas y su checksum |

## Relaciones

```text
roles 1 ───< user_roles >─── 1 users ───< oauth_accounts
                                  ├──< refresh_tokens
                                  ├──< employee_invitations >─── roles
                                  ├──< devices 1 ───< repair_requests
                                  │                       ├──< repair_status_history
                                  │                       ├──< diagnoses
                                  │                       ├──< estimates 1 ───< estimate_items
                                  │                       └──< repair_photos
                                  ├──< notifications
                                  └──< audit_events
services 1 ───< estimate_items
customers 1 ───< devices 1 ───< repair_requests >─── 1 repair_intakes 1 ───< repair_intake_items
customers 1 ───< repair_requests
```

## Normalización

- **1FN:** cada campo contiene un solo valor. Los conceptos de un presupuesto están en filas separadas de `estimate_items`, no en una cadena de repuestos.
- **2FN:** las relaciones de pertenencia se separan en `user_roles`; los atributos de un concepto dependen de su propio `estimate_item` y no de una parte de otra relación.
- **3FN:** el nombre del rol vive en `roles`, el perfil en `users`, el equipo en `devices` y el estado histórico en `repair_status_history`; no se repiten esos datos descriptivos en las solicitudes.

## Integridad y seguridad

Hay PK, FK, índices por propietario/estado/fecha, `UNIQUE` para correos, proveedores OAuth, nombres de servicios y números de serie cuando se informan. Las operaciones de creación de reparación, cambios de estado y presupuestos usan transacciones. Las consultas son parametrizadas y no exponen la base a la APK.

## Migraciones

`Backend/src/utils/migrate.ts` crea la base configurada si no existe, crea `schema_migrations` y procesa los archivos SQL ordenados por versión. Cada archivo se ejecuta completo, se registra con su nombre y SHA-256, y luego se omite si ya está aplicado con el mismo checksum. Una modificación posterior, un archivo eliminado o una versión duplicada detienen el proceso.

`001_init.sql` crea tablas comunes, `002_evidence_data.sql` completa la estructura de evidencias heredada, `003_techfix_domain.sql` crea el dominio TechFix con fotografías persistibles, `004_employee_identity.sql` agrega `recepcionista` y `employee_invitations`, y `005_presential_intake.sql` agrega clientes comerciales, vínculo opcional de equipos/órdenes e ingresos presenciales. La 005 no borra datos: vuelve nullable `devices.owner_id` para conservar la relación histórica y permitir equipos sin cuenta.

La migración 005 agrega una clave única nullable de idempotencia en `repair_requests`; los reintentos se controlan en una transacción del backend. Los accesorios se normalizan en `repair_intake_items`, no se almacenan como una lista serializada.

El runner no elimina ni recrea tablas existentes. Si una migración falla, no inserta su versión en `schema_migrations` y detiene las siguientes. Como MySQL puede confirmar implícitamente operaciones DDL, esto no promete rollback completo: se debe revisar el estado de la base antes de reintentar.

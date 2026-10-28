# TECHFIX — Análisis de impacto y rediseño funcional

Fecha del análisis: 28/10/2026

## 1. Alcance y criterio de verificación

Este documento analiza el estado real del código presente en:

`<RUTA_LOCAL_DEL_PROYECTO>`

La tarea fue exclusivamente de análisis. En esta fase no se ejecutaron migraciones, `UPDATE`, `DELETE`, `DROP`, cambios de esquema, cambios de usuarios, cambios de roles, cambios de secretos, regeneración de APK ni commits de implementación.

El repositorio tenía cambios locales previos a este análisis. Se conservaron y no se usaron como motivo para modificar código. Entre ellos se encuentran la actualización a Expo SDK 58, el runner de migraciones versionadas, el diagnóstico temporal de `/health` y la corrección reciente de permisos de equipos y reparaciones.

La clasificación utilizada es:

- **Implementado y verificable estáticamente:** existe código coherente y se pudo localizar su ruta, controlador, servicio o pantalla.
- **Implementado sin verificación de infraestructura:** existe el código, pero no se comprobó en esta fase contra MySQL real, proveedores OAuth o un dispositivo Android.
- **Parcial:** existe una parte del flujo, pero faltan reglas, pantallas, datos o endpoints necesarios para el proceso empresarial.
- **No implementado:** no se encontraron tablas, rutas, servicios o pantallas que resuelvan el requisito.

## 2. Resumen ejecutivo

TechFix está construido actualmente como una aplicación de seguimiento de reparaciones orientada al cliente final:

1. El usuario se registra como `cliente`.
2. Registra su propio equipo.
3. Crea una solicitud de reparación.
4. Consulta el estado, diagnóstico y presupuesto.
5. Puede aceptar o rechazar un presupuesto desde la aplicación.

El modelo empresarial definitivo es diferente: TechFix debe ser una herramienta interna para un local físico. El cliente llega al negocio y un empleado de recepción registra sus datos, el equipo y la orden. El cliente no necesita instalar la APK ni tener credenciales. El personal interno trabaja sobre la orden hasta registrar la entrega física.

La arquitectura técnica actual es reutilizable, pero el dominio funcional necesita una migración importante:

- El rol `recepcionista` no existe en las migraciones ni en los tipos principales.
- No existe una entidad independiente para clientes presenciales.
- `devices.owner_id` y `repair_requests` asumen que el cliente es un usuario autenticado.
- No hay pantalla ni endpoint para recepción de clientes.
- No hay tabla ni endpoint de entrega física.
- La decisión del presupuesto se actualiza directamente en `estimates`, sin una entidad de decisión presencial con actor, fecha, canal y observación.
- No hay registro normalizado de accesorios ni estado físico de ingreso/entrega.
- Hay módulos de `projects` y `tasks` heredados que no pertenecen al flujo de servicio técnico y aumentan la superficie de autorización.

La recomendación es una migración aditiva y compatible: conservar usuarios, equipos, reparaciones e historiales existentes; agregar el modelo interno; adaptar primero el Backend; mantener temporalmente compatibilidad con el modelo anterior; y retirar la lógica antigua solo después de backfills y pruebas.

## 3. Inventario actual confirmado

### 3.1 Frontend

La aplicación Expo está en SDK 58 según `Frontend/package.json`, con React Native 0.88, React 19.3, Expo Router, Context API, React Hook Form, Zod y SecureStore.

Rutas encontradas:

- Autenticación: `Frontend/app/(auth)/welcome.tsx`, `login.tsx`, `register.tsx`, `social.tsx`.
- Aplicación: `Frontend/app/(app)/index.tsx`, `profile.tsx`, `settings.tsx`, `notifications.tsx`, `stats.tsx`.
- Equipos: `Frontend/app/(app)/devices/index.tsx`, `new.tsx`, `[id].tsx`.
- Reparaciones: `Frontend/app/(app)/repairs/index.tsx`, `new.tsx`, `[id].tsx`.
- Administración: `Frontend/app/admin/users.tsx`.
- Módulos heredados: `Frontend/app/(app)/projects/*` y `Frontend/app/(app)/tasks/*`.
- Capacidades nativas: `Frontend/app/native/qr-scanner.tsx`, `repair-photo.tsx`, `task-evidence.tsx`, `local-location.tsx`, `sensor-demo.tsx` y `network-diagnostic.tsx`.

El layout `Frontend/app/(app)/_layout.tsx` muestra pestañas de Inicio, Equipos, Reparaciones, Perfil y Ajustes. Las rutas de proyectos y tareas se mantienen ocultas mediante `href: null`, pero sus endpoints siguen publicados en el Backend.

La pantalla `Frontend/app/(app)/settings.tsx` todavía muestra el texto `Expo SDK 57`, aunque el paquete actual declara SDK 58. Es una inconsistencia documental/visual, no una prueba de que el runtime use SDK 57.

### 3.2 Backend

El Backend usa Express, TypeScript, `mysql2/promise`, Zod, bcryptjs, JWT, rate limiting, Helmet, CORS y Swagger.

Módulos publicados por `Backend/src/server.ts`:

- `/api/auth`
- `/api/users`
- `/api/projects`
- `/api/tasks`
- `/api/devices`
- `/api/repairs`
- `/api/services`
- `/api/notifications`, `/api/stats/overview` y `/api/audit`

La autenticación recarga el usuario desde MySQL en cada request autenticada. Esto permite que una cuenta deshabilitada pierda acceso aunque todavía tenga un access token no vencido. El access token dura 15 minutos y el refresh token se almacena como hash, rota y puede revocarse.

La autorización de TechFix se encuentra principalmente en:

- `Backend/src/middlewares/auth.middleware.ts`
- `Backend/src/controllers/device.controller.ts`
- `Backend/src/controllers/repair.controller.ts`
- `Backend/src/repositories/repair.repository.ts`
- `Backend/src/utils/repair-status.ts`
- `Backend/src/utils/techfix-permissions.ts`

La utilidad `techfix-permissions.ts` y sus pruebas pertenecen a cambios locales recientes. En el estado actual distinguen administrador, técnico y cliente, pero todavía no contemplan `recepcionista`.

### 3.3 MySQL y migraciones

Migraciones existentes:

- `Backend/database/migrations/001_init.sql`: usuarios, roles, OAuth, sesiones de renovación, proyectos, tareas, notificaciones, auditoría y evidencias genéricas.
- `Backend/database/migrations/002_evidence_data.sql`: completa `task_evidence`.
- `Backend/database/migrations/003_techfix_domain.sql`: equipos, servicios, reparaciones, historial de estados, diagnósticos, presupuestos, conceptos y fotografías.

El esquema utiliza InnoDB, claves primarias, claves foráneas, índices y restricciones `UNIQUE`. El runner `Backend/src/utils/migrate.ts` ejecuta archivos completos, registra versiones y checksums en `schema_migrations`, detecta modificaciones y detiene las siguientes migraciones ante errores. No se ejecutó durante este análisis.

El modelo actual es razonablemente normalizado para el dominio original, pero acopla el cliente comercial a `users`. No hay tablas para clientes presenciales, recepción, accesorios, autorización presencial o entrega.

## 4. Diferencias entre el modelo actual y el modelo presencial

| Tema | Modelo actual confirmado | Modelo empresarial esperado | Impacto |
|---|---|---|---|
| Identidad del cliente | El cliente es un usuario autenticado de `users`. | El cliente puede ser una persona registrada por recepción y no tener cuenta. | Alto: requiere desacoplar cliente comercial de identidad de login. |
| Alta de usuarios | `/api/auth/register` crea siempre un `cliente`. | Los empleados deben ser dados de alta o invitados por un administrador. | Alto: no se debe permitir autoasignación de privilegios. |
| Recepción | No existe pantalla ni endpoint específico. | Recepción registra cliente, equipo, ingreso y orden. | Alto. |
| Equipos | `devices.owner_id` apunta a `users.id`; el cliente autenticado crea el equipo. | Recepción registra el equipo para un cliente comercial. | Alto: asociación aditiva a `customers`. |
| Reparaciones | El cliente crea la solicitud desde la APK; el repositorio exige que el equipo sea suyo. | Recepción crea la orden y puede usar un cliente sin cuenta. | Alto. |
| Asignación | El administrador asigna técnicos. | Se conserva; recepción no asigna salvo autorización explícita futura. | Bajo/medio. |
| Diagnóstico | El técnico asignado puede crear diagnósticos. | Se conserva; recepción solo consulta. | Bajo. |
| Presupuesto | El técnico lo crea; el cliente autenticado acepta o rechaza en la APK. | El cliente decide presencialmente y recepción registra la decisión. | Alto: separar propuesta de decisión presencial. |
| Entrega | Solo existe el estado `entregado`; no hay registro de entrega. | Deben quedar fecha, empleado, receptor y observaciones. | Alto. |
| Accesorios/estado físico | No existe modelo específico. | Deben registrarse para evitar reclamos en recepción. | Medio/alto. |
| Historial | Existe `repair_status_history`. | Debe incluir también recepción, presupuesto presencial y entrega. | Medio. |
| Cliente en la APK | Tiene flujo completo de equipos, solicitudes y presupuestos. | No necesita instalar ni autenticarse. | Alto: convertirlo en compatibilidad opcional, no en flujo principal. |
| Proyectos/tareas | Existen migraciones, API y pantallas heredadas. | No forman parte del proceso de servicio técnico definido. | Medio: mantener temporalmente o deprecar controladamente. |

## 5. Estado de los requisitos funcionales

### Implementado y verificable estáticamente

- Expo/React Native/TypeScript y Expo Router.
- Context API con `useReducer` para sesión y contexto de tema.
- Formularios con React Hook Form y validación Zod.
- SecureStore para tokens y preferencias de sesión local.
- Login, refresh, logout y recuperación de sesión en código.
- OAuth server-side para Google, GitHub y Discord, con PKCE, `state` y handoff de un solo uso.
- Roles actuales `admin`, `tecnico` y `cliente`.
- CRUD de equipos del modelo actual.
- Listado de reparaciones según rol, asignación, transiciones, diagnósticos, presupuestos y fotografías.
- Notificaciones, estadísticas y auditoría básica.
- Tema claro, oscuro y sistema.
- Cámara, QR, ubicación, biometría y sensores en rutas de Expo.
- Migraciones versionadas con checksums.
- Documentación principal, instalación, API, base de datos, arquitectura, pruebas y matriz.
- Perfil EAS `preview` configurado como APK.

### Implementado sin verificación de infraestructura en este análisis

- Conexión real a MySQL en el entorno definitivo.
- Registro y login contra datos persistidos en la instancia objetivo.
- Refresh y revocación de tokens contra una base real.
- OAuth real con credenciales de Google, GitHub y Discord.
- Instalación de la APK en un dispositivo y flujo completo contra una API accesible.
- Cámara, QR, biometría, ubicación y sensores en hardware real.

La documentación existente declara que Expo Doctor, exportación Android y compilación local SDK 58 fueron ejecutados. También declara que MySQL real, OAuth, instalación física y pruebas de hardware siguen pendientes. Esas afirmaciones deben mantenerse separadas de una prueba integral del nuevo flujo presencial.

### Parcialmente implementado

- **Roles:** hay autorización para `admin`, `tecnico` y `cliente`, pero no `recepcionista`.
- **Usuarios:** el administrador puede listar, cambiar roles y habilitar/deshabilitar; no existe invitación o aprobación específica de empleados.
- **Reparaciones:** el flujo técnico existe, pero el creador es el cliente autenticado.
- **Presupuestos:** existe propuesta y aprobación digital; no existe decisión presencial con trazabilidad propia.
- **Auditoría:** registra varias acciones sensibles, pero no todos los cambios de equipos, clientes, entregas y asociaciones futuras.
- **Frontend por rol:** se ocultan algunos accesos de técnicos, pero no existe un panel de recepción ni guardas generales para todas las rutas heredadas.

### No implementado para el nuevo modelo

- Entidad `customers` independiente.
- Alta de cliente por recepción.
- Invitación o aprobación administrativa de empleados.
- Registro presencial de ingreso.
- Accesorios entregados y condición física normalizados.
- Endpoint/pantalla para decisión presencial de presupuesto.
- Endpoint/pantalla para entrega física.
- Comprobante o constancia de retiro.
- Panel de recepción.
- Matriz de pruebas del nuevo circuito ejecutada contra MySQL real.

## 6. Matriz de impacto

| Módulo | Comportamiento actual confirmado | Comportamiento esperado | Archivos involucrados | Modificaciones necesarias | Impacto en MySQL | Riesgo | Prioridad | Pruebas necesarias |
|---|---|---|---|---|---|---|---|---|
| Autenticación | Registro público crea `cliente`; login y OAuth existen. | Mantener login y registro exigidos por la consigna, pero el flujo interno debe usar empleados aprobados. | `Backend/src/routes/auth.routes.ts`, `Backend/src/controllers/auth.controller.ts`, `Backend/src/services/auth.service.ts`, `Backend/src/services/oauth.service.ts`, `Frontend/app/(auth)/*` | Separar registro público de alta de empleados; agregar invitación/aprobación. | Tabla aditiva de invitaciones; no borrar usuarios existentes. | Alto | P0 | Registro cliente, invitación expirada, invitación usada, login empleado, OAuth pendiente. |
| Roles | Migraciones insertan `admin`, `tecnico`, `cliente`; `domain.ts` conserva roles heredados. | Agregar `recepcionista`; conservar `cliente` para compatibilidad del requisito de login/social. | `001_init.sql`, `003_techfix_domain.sql`, `Backend/src/types/domain.ts`, `Backend/src/types/techfix.ts`, `user.controller.ts`, `Admin users` | Política de roles efectiva y sin combinaciones ambiguas; permitir al admin asignar recepcionista. | `INSERT` aditivo en `roles`; no renombrar ni eliminar roles. | Alto | P0 | Matriz de 4 identidades: admin, recepcionista, técnico y cliente legado. |
| Usuarios internos | Admin lista usuarios, cambia roles y estados; no hay alta de empleados por invitación. | Admin invita/aprueba empleados y conserva protección del último admin. | `Backend/src/routes/user.routes.ts`, `user.controller.ts`, `user.repository.ts`, `Frontend/app/admin/users.tsx` | Endpoint de invitación y pantalla administrativa; validar roles internos. | `employee_invitations` o equivalente; índices por token/estado/expiración. | Alto | P0 | No autoelevación, invitación única, último admin, empleado deshabilitado. |
| Clientes | `users` con rol `cliente`; no existe CRUD de clientes sin cuenta. | Recepción crea y edita clientes comerciales. | `user.repository.ts`, `auth.service.ts`, futuros controladores; no hay archivo actual de customers | Agregar módulo `customers`, servicios, rutas y pantallas. | Tabla `customers`; vínculo opcional con `users`. | Alto | P0 | Cliente sin cuenta, cliente vinculado, duplicados, datos de contacto. |
| Equipos | Cliente crea equipos propios; admin puede gestionarlos; técnico debe ser rechazado por permisos actuales del working tree. | Recepción/admin registran equipos para clientes; técnico no registra ni modifica. | `Backend/src/controllers/device.controller.ts`, `device.repository.ts`, `device.routes.ts`, `Frontend/app/(app)/devices/*` | Aceptar `customerId` en flujo interno y mantener compatibilidad temporal con `owner_id`. | Columna nullable `customer_id`, FK e índice; backfill controlado. | Alto | P0 | Recepción crea, cliente legado conserva acceso, técnico 403, admin global. |
| Ingreso y orden | `POST /api/repairs` crea desde cliente y exige propiedad del equipo. | Recepción/admin crean una orden con cliente, equipo, recepción y estado inicial. | `repair.controller.ts`, `repair.repository.ts`, `repair.routes.ts`, `Frontend/app/(app)/repairs/new.tsx` | Nuevo endpoint o modo interno; separar creador de cliente; registrar empleado receptor. | Columnas/tabla de intake aditivas; no borrar `clientId` histórico inmediatamente. | Alto | P0 | Orden presencial, cliente sin login, equipo ajeno, duplicación accidental, transacción. |
| Asignación | `POST /repairs/:id/assign` solo admin. | Admin asigna/reasigna técnico activo con rol válido. | `repair.controller.ts`, `repair.repository.ts`, `Frontend/app/(app)/repairs/[id].tsx` | Mantener endpoint; agregar auditoría de reasignación y UI administrativa. | Posible tabla histórica de asignaciones; opcional pero recomendable. | Medio | P1 | Técnico inactivo, usuario sin rol técnico, reasignación, acceso del técnico anterior. |
| Diagnóstico | Técnico asignado crea diagnóstico; el admin fue habilitado en el working tree aunque la documentación anterior decía solo técnico. | Técnico asignado crea; recepción consulta; admin supervisa o corrige según política definida. | `repair.controller.ts`, `repair.repository.ts`, `repair-status.ts`, `repairs/[id].tsx` | Definir si admin puede crear/corregir; proteger edición y auditoría. | No requiere tabla nueva; puede ampliar auditoría. | Medio | P1 | Técnico asignado/no asignado, recepción solo lectura, historial. |
| Presupuesto | Técnico/admin crean; cliente autenticado acepta/rechaza mediante PATCH. | Técnico propone; recepción registra aceptación/rechazo presencial; admin supervisa. | `repair.controller.ts`, `repair.repository.ts`, `techfix.validators.ts`, `repairs/[id].tsx` | Agregar decisión presencial separada de propuesta; cliente digital queda opcional. | Tabla `estimate_decisions` o historial de decisiones; índices y FK. | Alto | P0 | Aceptación, rechazo, doble decisión, actor no autorizado, reintento. |
| Estados | ENUM y `repair-status.ts` controlan transiciones técnicas; existe `entregado` pero no registro de entrega. | Agregar estados/acciones solo si el circuito los necesita; registrar actor y motivo. | `003_techfix_domain.sql`, `repair-status.ts`, `repair.controller.ts`, `StatusBadge.tsx` | Definir transición exacta entre presupuesto, reparación y entrega; no cambiar ENUM sin plan. | Migración aditiva o tabla de eventos para evitar ruptura histórica. | Alto | P0 | Todas las transiciones por rol y estado histórico. |
| Entrega | No existe endpoint ni tabla; solo estado `entregado`. | Recepción registra entrega física con fecha, empleado, receptor y observaciones. | No hay archivo actual específico; `repair.controller.ts` y `repairs/[id].tsx` deberán ampliarse | Crear servicio, endpoint, pantalla y comprobante. | Tabla `repair_deliveries`, índice único por reparación y FKs. | Alto | P0 | No entregar sin reparación lista, doble entrega, actor, fecha y auditoría. |
| Accesorios/estado físico | No existe modelo de accesorios de ingreso. | Registrar elementos recibidos y condición para prevenir reclamos. | No hay implementación actual | Crear formulario y modelo normalizado. | `repair_intake_items` o tabla equivalente, filas por accesorio. | Medio | P1 | Múltiples accesorios, condición, ausencia, devolución. |
| Fotografías | `repair_photos` guarda Base64 y metadatos; técnico asignado/admin pueden adjuntar. | Conservar para diagnóstico; recepción puede consultar, no editar. | `repair.repository.ts`, `repair-photo.tsx`, `003_techfix_domain.sql` | Revisar tamaño, almacenamiento privado y permisos de lectura. | Sin cambio obligatorio; posible migración futura a storage privado. | Alto | P1 | Acceso solo a orden autorizada, tamaño, MIME, no exposición pública. |
| Historial/auditoría | `repair_status_history` existe; `audit_events` registra varias acciones. | Toda acción presencial y sensible debe ser trazable. | `audit.service.ts`, `repair.repository.ts`, `user.repository.ts` | Auditar customer, intake, presupuesto presencial, entrega y asignaciones. | Puede reutilizar tablas existentes; agregar metadata solo si es necesario. | Medio | P1 | Actor, fecha, recurso, antes/después y no manipulación desde cliente. |
| Navegación | Cliente ve equipos/solicitudes; técnico ve reparaciones asignadas; admin tiene usuarios. | Paneles separados para admin, recepción y técnico; cliente queda opcional. | `Frontend/app/(app)/_layout.tsx`, `index.tsx`, `devices/*`, `repairs/*`, `admin/*` | Crear panel y rutas de recepción; guards por rol y recurso. | Ninguno directo. | Medio | P0 | Deep links, sesión revocada, rol cambiado, opciones ocultas. |
| Proyectos/tareas | API y migraciones completas, rutas ocultas parcialmente en tabs. | No deben interferir con la operación de servicio técnico. | `001_init.sql`, `project*`, `task*`, `Frontend/app/(app)/projects/*`, `tasks/*` | Decidir conservación como módulo académico o deprecación progresiva; no borrar sin inventario. | Ninguno inmediato. | Medio | P2 | Verificar que no abran una vía de permisos no deseada. |
| Documentación | Docs describen el modelo cliente-autoservicio y declaran pendientes externos. | Docs deben reflejar recepción, empleados, entrega y estado real. | `Documentacion/*.md`, `README.md`, `openapi.ts` | Actualizar después de implementar, no antes. Corregir la mención SDK 57 en Ajustes. | Ninguno. | Bajo | P1 | Revisión cruzada código/documentación/matriz. |

## 7. Matriz de permisos propuesta

La matriz diferencia el permiso global del alcance sobre recursos. Un permiso de Frontend nunca reemplaza el control del Backend.

| Acción | Administrador | Recepcionista | Técnico | Alcance y controles obligatorios |
|---|---|---|---|---|
| Iniciar sesión | Sí | Sí | Sí | Cuenta activa y credenciales válidas. |
| Registro público | Cliente compatible | No | No | El registro público crea `cliente`; nunca crea empleado privilegiado. |
| Invitar empleado | Sí | No | No | Invitación de un solo uso, expiración y auditoría. |
| Aprobar/asignar rol | Sí | No | No | Validar catálogo y proteger último admin. |
| Habilitar/deshabilitar usuario | Sí | No | No | No deshabilitar último admin; auditar. |
| Ver usuarios globales | Sí | No | No | Recepción solo ve clientes necesarios mediante endpoint acotado. |
| Ver/editar perfil propio | Sí | Sí | Sí | Campos permitidos y sin modificar roles. |
| Crear cliente comercial | Sí | Sí | No | Recepción y admin; evitar duplicados por criterio definido. |
| Ver cliente | Sí | Sí | Técnico solo de órdenes asignadas | Minimización de PII y control de pertenencia. |
| Editar cliente | Sí | Campos de contacto autorizados | No | Auditar cambios sensibles. |
| Eliminar cliente | No físico; desactivar/anonymizar según política | No | No | No borrar si tiene historial; definir retención. |
| Registrar equipo | Sí | Sí | No | Asociar a `customer_id`; nunca confiar en owner enviado por cliente. |
| Ver equipo | Global | Equipos atendidos | Solo mediante reparación asignada | No exponer listado global al técnico. |
| Editar equipo | Sí | Antes de restricciones de negocio | No | Control de orden asociada e historial si cambia identidad. |
| Eliminar equipo | Según política | Solo si no tiene órdenes | No | Mejor archivar; FK e historial impiden borrado destructivo. |
| Crear orden | Sí | Sí | No | Cliente y equipo deben existir; empleado creador queda registrado. |
| Ver órdenes | Todas | Necesarias para atención | Solo asignadas | Filtro en query y verificación en detalle. |
| Editar datos de recepción | Sí | Sí | No | No permitir alterar diagnóstico técnico desde recepción. |
| Asignar/reasignar técnico | Sí | No | No | Técnico activo y rol válido; auditar anterior/nuevo. |
| Registrar diagnóstico | Supervisar/corregir según política | No | Sí, solo asignado | Verificación de `assigned_technician_id`. |
| Ver diagnóstico | Sí | Sí | Solo órdenes asignadas | Minimización por recurso. |
| Crear presupuesto | Sí | No | Sí, solo asignado | Total calculado en Backend. |
| Editar presupuesto | Sí | No | Técnico mientras esté permitido | Proteger presupuesto ya decidido. |
| Aceptar/rechazar presencialmente | Sí | Sí | No | Actor, fecha, canal y observación en tabla propia. |
| Aceptar/rechazar digital opcional | Sí | No | No | Solo cliente vinculado si se conserva portal. |
| Cambiar estados técnicos | Sí | No salvo estados de recepción definidos | Sí, solo asignado | Máquina de estados en Backend, no en UI. |
| Adjuntar fotografía | Sí | No | Sí, solo asignado | MIME/tamaño, almacenamiento privado y auditoría. |
| Consultar fotografías | Sí | Sí según orden | Solo asignadas | Nunca por URL pública sin autorización. |
| Registrar entrega | Sí | Sí | No | Una entrega por orden; validar estado y receptor. |
| Anular/editar entrega | Sí, con auditoría | No o corrección controlada | No | No eliminar el registro original. |
| Consultar estadísticas | Global | Operativas | De asignadas | El query debe aplicar alcance por rol. |
| Consultar auditoría | Sí | No | No | Solo admin. |
| Administrar servicios/precios | Sí | Consulta | Consulta | `POST/PATCH /services` ya es admin-only. |

### Endpoints que requerirán control de propiedad o asignación

- `/api/customers/:id`: admin/recepción según cliente atendido; no técnico salvo datos de una orden asignada.
- `/api/devices/:id`: admin/recepción global o de orden; cliente legado solo propietario; técnico solo por orden asignada.
- `/api/repairs`: listado filtrado por alcance; creación interna solo admin/recepción.
- `/api/repairs/:id`: admin/recepción según atención; técnico solo asignado; cliente legado solo vinculado.
- `/api/repairs/:id/diagnosis`, `/estimates`, `/photos`: técnico asignado y admin según operación.
- `/api/repairs/:id/estimates/:estimateId/decision`: admin/recepción; cliente digital solo si se conserva el portal.
- `/api/repairs/:id/delivery`: admin/recepción; operación idempotente y auditada.
- `/api/users/:id/roles` y `/status`: exclusivamente admin.
- `/api/audit`: exclusivamente admin.

## 8. Modelo de datos propuesto

### 8.1 Mantener sin romper

Se deben conservar:

- `users`, `roles`, `user_roles`.
- `oauth_accounts`, `refresh_tokens`, `oauth_states`, `oauth_handoffs`.
- `devices`, `repair_requests`, `repair_status_history`.
- `diagnoses`, `estimates`, `estimate_items`, `repair_photos`.
- `notifications`, `audit_events`, `services`.

No se debe renombrar `cliente` ni convertir automáticamente usuarios cliente en empleados.

### 8.2 Tablas y columnas nuevas recomendadas

#### `customers`

Cliente comercial independiente de la identidad de login:

- `id` PK.
- `first_name`, `last_name`.
- `document_number` opcional y con unicidad solo si la política lo exige.
- `email`, `phone`, `address` o campos de contacto definidos.
- `user_id` nullable, UNIQUE, para vincular opcionalmente un usuario `cliente` existente.
- `created_by`, `created_at`, `updated_at`, `is_active`.

No se debe duplicar la información del cliente en cada reparación. La orden referencia a `customers`.

#### `employee_invitations`

- `id` PK.
- `email`.
- `role` restringido a `recepcionista` o `tecnico`.
- `token_hash` UNIQUE.
- `expires_at`, `used_at`.
- `invited_by`, `created_at`.

El token nunca debe almacenarse en texto plano. El alta debe comprobar que la invitación está vigente y no fue utilizada.

#### Compatibilidad de `devices`

Agregar inicialmente `customer_id` nullable y conservar `owner_id` mientras se completa el backfill. Luego:

- nuevos registros internos usan `customer_id`;
- registros históricos se asocian de manera controlada;
- consultas duales durante la transición;
- el retiro de `owner_id` queda para una migración posterior, con evidencia de que no hay referencias pendientes.

#### Compatibilidad de `repair_requests`

Agregar de forma aditiva:

- `customer_id` nullable mientras se migra desde el equipo;
- `created_by` para el empleado que creó la orden;
- `received_by` o una relación con la tabla de ingreso;
- conservar `device_id` y el historial existente.

#### `repair_intakes`

Una fila por ingreso físico:

- `id` PK.
- `repair_request_id` UNIQUE/FK.
- `received_by` FK a `users`.
- `received_at`.
- `physical_condition`.
- `customer_note`.
- `created_at`.

#### `repair_intake_items`

Una fila por accesorio o elemento entregado, evitando listas en una sola columna:

- `id` PK.
- `repair_intake_id` FK.
- `description`.
- `condition_at_intake`.
- `returned_at_delivery` o estado de devolución.

#### `estimate_decisions`

Una fila por decisión o corrección controlada:

- `id` PK.
- `estimate_id` FK.
- `decision` (`aprobado`/`rechazado`).
- `decided_by` FK a admin/recepción.
- `channel` (`presencial`, y `digital` solo si se conserva el portal).
- `decided_at`.
- `note`.

El estado actual de `estimates` puede conservarse como dato derivado/operativo, mientras que la tabla registra la trazabilidad.

#### `repair_deliveries`

Una entrega por reparación:

- `id` PK.
- `repair_request_id` UNIQUE/FK.
- `delivered_by` FK a admin/recepción.
- `delivered_to_name` y, si corresponde, identificación verificada.
- `delivered_at`.
- `observation`.
- `created_at`.

La entrega no debe eliminar el historial ni permitir una segunda entrega accidental.

### 8.3 Normalización

El modelo propuesto mantiene 1FN porque accesorios y decisiones se almacenan como filas, no como listas. Mantiene 2FN porque las tablas de relación usan claves propias y sus atributos dependen de la relación completa. Mantiene 3FN porque los roles, clientes, usuarios, órdenes, presupuestos, decisiones y entregas tienen responsabilidades separadas; no se repiten nombres de clientes, roles o empleados en cada orden.

## 9. Estrategia de conservación de datos

No se deben ejecutar cambios de esquema hasta contar con respaldo verificable.

Secuencia recomendada:

1. Crear un dump completo de estructura y datos, verificar que pueda restaurarse y conservar una copia fuera del directorio de trabajo.
2. Registrar conteos de `users`, `user_roles`, `devices`, `repair_requests`, `repair_status_history`, `diagnoses`, `estimates`, `estimate_items` y `repair_photos`.
3. Agregar `recepcionista` mediante migración aditiva.
4. Crear `customers` e `employee_invitations`.
5. Agregar columnas nullable y tablas de intake, decisiones y entregas.
6. Crear una asociación explícita de clientes existentes con `customers`; no asumir que todos los usuarios `cliente` representan la misma persona comercial sin revisar duplicados.
7. Mantener una capa temporal de lectura compatible con `owner_id` y la nueva asociación.
8. Backfillear registros en lotes controlados y verificar conteos, huérfanos y restricciones.
9. Adaptar servicios y autorización para que el nuevo flujo interno sea el camino principal.
10. Mantener el registro público como cliente opcional por la consigna, pero impedir que cree roles internos.
11. Ejecutar pruebas de integración con una base de prueba restaurada desde un dump anonimizado.
12. Retirar columnas o lógica antigua solo en una fase posterior, después de comprobar que no existen referencias históricas pendientes.

No se recomienda que una migración futura haga `DROP`, renombre destructivo o convierta automáticamente un usuario `cliente` en `recepcionista` o `tecnico`.

## 10. Plan de implementación por etapas

### Fase 0 — Decisiones de alcance y respaldo

- Confirmar si el portal de cliente seguirá existiendo como funcionalidad opcional para cumplir registro/social.
- Definir campos mínimos del cliente, identificación y contacto.
- Definir estados exactos y quién puede registrar cada uno.
- Definir la constancia mínima de entrega.
- Respaldar y verificar restauración.

### Fase 1 — Política de identidad y roles

- Agregar `recepcionista` sin eliminar `cliente`.
- Crear invitaciones de empleados administradas por admin.
- Actualizar tipos, utilidades de permisos, API y panel administrativo.
- Evitar combinaciones ambiguas de roles o definir precedencia explícita.

### Fase 2 — Modelo de clientes e ingreso

- Crear `customers` y asociación opcional con `users`.
- Agregar `customer_id` de forma compatible.
- Crear pantallas de cliente, equipo e ingreso para recepción.
- Registrar empleado creador y datos de condición/accesorios.

### Fase 3 — Órdenes, asignación y operación técnica

- Permitir que admin/recepción creen órdenes.
- Mantener filtros por técnico asignado.
- Implementar transiciones con reglas por rol.
- Mantener diagnóstico, presupuesto y fotografías para el técnico asignado.

### Fase 4 — Presupuesto presencial y entrega

- Crear endpoint y pantalla de decisión presencial.
- Crear `repair_deliveries`.
- Validar que solo se entregue una orden lista y no entregada.
- Auditar cada acción.

### Fase 5 — Frontend y navegación

- Panel de admin.
- Panel de recepción.
- Panel técnico.
- Pantallas de cliente solo si se mantiene el portal opcional.
- Guards por rol, recurso y sesión.
- Corregir texto SDK 57 a SDK 58.

### Fase 6 — Compatibilidad y migración de datos

- Backfill en base de prueba.
- Comparar conteos y relaciones.
- Probar con los usuarios, equipos y reparaciones existentes.
- Mantener rollback documentado antes de producción.

### Fase 7 — Calidad, documentación y APK

- Pruebas unitarias, integración, seguridad y dispositivo.
- Actualizar OpenAPI y documentación.
- Generar una nueva APK después de completar los cambios.
- Instalarla y ejecutar el circuito completo en Android.

## 11. Plan de testing

### Autenticación y sesiones

- Registro público crea únicamente `cliente`.
- Invitación de recepción/técnico crea una sola cuenta y no permite cambiar el rol desde el cliente.
- Login, refresh rotativo, logout y revocación.
- Cuenta deshabilitada rechazada aunque conserve un access token.
- Persistencia y renovación desde la APK.
- OAuth de Google, GitHub y Discord con credenciales reales, PKCE, `state`, callback y vinculación segura.

### Permisos

- Admin puede administrar usuarios, roles, equipos, órdenes, servicios, estadísticas y auditoría.
- Recepción puede crear clientes, equipos, ingresos, órdenes, decisiones presenciales y entregas; no puede administrar roles ni diagnósticos.
- Técnico solo lista órdenes asignadas.
- Técnico no puede acceder a una orden no asignada mediante cambio de ID, QR o request manual.
- Cliente legado solo accede a sus propios recursos.
- Ningún rol puede elevarse manipulando el body.
- Último admin no puede ser deshabilitado ni perder el rol.

### Flujo presencial

1. Recepción crea un cliente sin usuario.
2. Recepción registra un equipo y accesorios.
3. Recepción crea una orden.
4. Admin asigna técnico.
5. Técnico registra diagnóstico y presupuesto.
6. Recepción registra aceptación o rechazo presencial.
7. Solo con presupuesto aprobado se permite avanzar a reparación.
8. Técnico documenta trabajo y finalización.
9. Recepción registra equipo listo y entrega.
10. La orden queda en historial y la segunda entrega es rechazada.

### Datos y MySQL

- Claves foráneas y restricciones `UNIQUE`.
- Cliente sin login y cliente vinculado a un usuario.
- Backfill sin huérfanos.
- Reintento idempotente de recepción, decisión y entrega.
- Transacciones de creación de orden, decisión y entrega.
- SQL parametrizado y revisión contra inyección.
- Restauración del backup.

### Frontend y Android

- Guardas por rol y deep links.
- Tema claro, oscuro y sistema.
- Estados de carga, errores 401/403/404/409/422/429/500.
- Permisos rechazados de cámara, ubicación y biometría.
- QR de orden no autorizada.
- Sensores no disponibles.
- API accesible desde el dispositivo.
- Instalación de APK independiente de Expo Go.
- Reapertura y sesión persistida.

## 12. Requisitos del Trabajo Integrador que se mantienen

El rediseño no elimina los requisitos académicos:

- React Native, Expo, TypeScript y navegación.
- API REST con Express y MySQL.
- JWT, refresh tokens, SecureStore y Context API.
- Registro/login y tres proveedores sociales. El registro/social puede conservarse como portal opcional de clientes, aunque no sea necesario para la atención presencial.
- Tres roles internos: administrador, recepcionista y técnico. El rol `cliente` se conserva como compatibilidad del requisito de autenticación y portal opcional.
- CRUD real de clientes, equipos, órdenes, servicios, presupuestos y operaciones de recepción.
- Validación, seguridad, rate limiting, auditoría y control por recurso.
- Tema claro/oscuro/sistema, UX accesible y manejo de errores.
- Cámara, QR, biometría, ubicación y sensores con permisos.
- Migraciones versionadas, normalización 1FN/2FN/3FN y documentación.
- Tests automatizados y matriz de requisitos.
- APK instalable y generación mediante EAS o proceso Android equivalente.

## 13. Riesgos y dependencias

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Migrar `users` a clientes comerciales sin criterio | Duplicados o pérdida de historial | `customers` aditiva, vínculo opcional y backfill revisado. |
| Agregar `recepcionista` rompiendo tipos o UI | Permisos inconsistentes | Actualizar catálogo, tipos, Backend, Frontend, OpenAPI y tests juntos. |
| Mantener cliente y empleado en la misma lógica | Elevación o filtrado incorrecto | Separar identidad comercial de identidad de login y definir precedencia. |
| Exponer todos los datos al técnico | Violación de privacidad | Queries por asignación y verificación de detalle en cada endpoint. |
| Usar solo el estado `entregado` | No hay trazabilidad de retiro | Tabla `repair_deliveries` con unicidad y auditoría. |
| Backfill incorrecto | Reparaciones asociadas a personas equivocadas | Backup, staging, conteos, revisión y migración reversible. |
| OAuth sin credenciales/HTTPS | No se puede validar identidad real | Mantener como pendiente hasta prueba real. |
| API en IP local | APK no funciona fuera de la red | Backend HTTPS público o configuración de red documentada. |
| Fotos Base64 en MySQL | Crecimiento y exposición accidental | Mantener permisos; evaluar storage privado con claves no públicas. |
| Proyectos/tareas heredados | Superficie de ataque y confusión de alcance | Ocultar, documentar como legado y retirar solo con inventario. |
| APK no instalada | No se valida el producto final | Dispositivo/emulador con ADB y pruebas de instalación independientes de Expo Go. |

## 14. Dependencias externas todavía pendientes

No deben marcarse como completadas sin evidencia real:

- Credenciales y callbacks de Google, GitHub y Discord.
- API HTTPS accesible desde el dispositivo.
- Instancia MySQL de prueba/producción y backup restaurable.
- Dispositivo Android o emulador con ADB.
- Pruebas físicas de cámara, QR, biometría, ubicación y sensores.
- Instalación y uso de la nueva APK.
- Revisión de vulnerabilidades y prueba de autorización con datos reales de prueba.

## 15. Recomendaciones técnicas finales

1. Adoptar el circuito presencial como flujo principal del Backend y no intentar resolverlo solamente ocultando pantallas del cliente.
2. Mantener `cliente` por compatibilidad con el requisito de autenticación, pero no usarlo como identidad obligatoria de una orden presencial.
3. Agregar `recepcionista` mediante migración aditiva y alta administrada por invitación.
4. Crear `customers`, `repair_intakes`, `repair_intake_items`, `estimate_decisions` y `repair_deliveries` antes de cambiar las pantallas principales.
5. Mantener `owner_id` y el flujo anterior durante una etapa de compatibilidad; no eliminar columnas ni migrar cuentas automáticamente.
6. Centralizar las políticas de autorización en Backend y reutilizar una matriz de permisos en Frontend solo para visibilidad.
7. Hacer que la entrega sea una operación idempotente y auditada, no solo una transición de estado.
8. Actualizar OpenAPI, manual, instalación, pruebas y matriz de requisitos después de cada fase implementada.
9. Corregir la etiqueta visual `Expo SDK 57` de `Frontend/app/(app)/settings.tsx` antes de la entrega.
10. Generar y verificar una APK nueva únicamente después de completar el modelo presencial y ejecutar el circuito completo.

## 16. Conclusión

TechFix tiene una base técnica sólida para continuar: la separación Frontend/API/MySQL, la autenticación, las migraciones versionadas, el control de técnicos asignados, el historial, los presupuestos y las capacidades nativas ya ofrecen una estructura útil.

Sin embargo, el producto actual no representa todavía el negocio presencial definitivo. La diferencia no es un ajuste visual: requiere desacoplar clientes comerciales de cuentas de login, incorporar recepción, registrar ingreso y accesorios, modelar decisiones presenciales y registrar entregas.

La siguiente acción recomendada es aprobar este alcance y el plan aditivo. La implementación debe comenzar por respaldo, modelo de clientes y política de roles; no por una nueva APK ni por modificaciones directas sobre la base real.

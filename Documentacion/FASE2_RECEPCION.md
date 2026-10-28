# TechFix — Fase 2: clientes y recepción presencial

Fecha de preparación: 28/10/2026.

## Alcance

Esta fase incorpora el circuito del local presencial: un administrador o recepcionista registra un cliente comercial sin cuenta, asocia un equipo, registra el motivo de ingreso y deja una orden con accesorios, condición y responsable autenticado.

El rol `cliente` legado se conserva para no romper los registros ni los flujos existentes. No se convirtió automáticamente ningún usuario en cliente comercial y ningún registro existente se copia o elimina.

La Fase 2 no incluye facturación, pagos, inventario, chat, portal completo para clientes comerciales ni asignación técnica por recepción.

## Arquitectura del módulo

```text
Frontend Expo Router
  customers/       búsqueda, alta, detalle y equipo vinculado
  intakes/         recepción, accesorios y confirmación de orden
  repairs/         consulta de órdenes según permisos
       │ servicios HTTP con JWT + Idempotency-Key
       ▼
Backend Express
  customer.routes  → customer.controller  → customer.repository
  intake.routes    → intake.controller    → repair.repository (transacción)
       │ políticas centralizadas + Zod + auditoría
       ▼
MySQL/MariaDB
  customers → devices → repair_requests → repair_intakes → repair_intake_items
```

El Backend obtiene `created_by` y `received_by` del usuario autenticado. El cliente móvil solo propone `customerId` y `deviceId`; la API verifica que existan, estén activos cuando corresponde y que el equipo pertenezca al cliente seleccionado.

## Modelo de datos

La migración `Backend/database/migrations/005_presential_intake.sql` es aditiva y no edita 001–004.

| Tabla/cambio | Propósito | Integridad |
|---|---|---|
| `customers` | Cliente comercial independiente de `users` | documento único cuando se informa; `created_by` nullable con FK a `users` |
| `devices.customer_id` | Asociación opcional del equipo a un cliente comercial | FK e índice; `owner_id` se vuelve nullable para conservar equipos sin cuenta |
| `repair_requests.customer_id` | Cliente comercial de la orden | FK nullable; los históricos siguen usando `devices.owner_id` |
| `repair_requests.created_by` | Usuario que originó la orden | FK nullable y `ON DELETE SET NULL` |
| `repair_requests.intake_idempotency_key` | Evitar duplicados por reintento | `UNIQUE` nullable |
| `repair_intakes` | Recepción física, responsable, fecha, condición y observaciones | una recepción por orden; FKs a orden y usuario |
| `repair_intake_items` | Accesorios y seguimiento de devolución | filas independientes; devolución mediante `return_status` y `returned_at` |

La migración no contiene `DROP`, no recrea tablas y no copia datos. Como incluye DDL de MySQL, el runner puede dejar cambios estructurales parciales si una sentencia posterior falla; por eso primero se prueba en una base derivada y se revisan las tablas antes de reintentar.

## Endpoints

Todos requieren `Authorization: Bearer <accessToken>` salvo los endpoints públicos de autenticación.

| Método | Ruta | Roles | Resultado |
|---|---|---|---|
| GET | `/api/customers?search=&page=&pageSize=` | `admin`, `recepcionista` | listado paginado |
| POST | `/api/customers` | `admin`, `recepcionista` | alta de cliente comercial |
| GET | `/api/customers/:id` | `admin`, `recepcionista` | detalle |
| PATCH | `/api/customers/:id` | `admin`; recepción solo contacto/notas | edición autorizada |
| PATCH | `/api/customers/:id/status` | `admin` | activar/desactivar |
| GET | `/api/intakes` | `admin`, `recepcionista` | órdenes de recepción |
| GET | `/api/intakes/:id` | `admin`, `recepcionista` | orden e ingreso físico |
| POST | `/api/intakes` | `admin`, `recepcionista` | crea orden, historial, ingreso y accesorios |
| GET | `/api/devices?customerId=:id` | `admin`, `recepcionista` | equipos del cliente comercial |
| POST | `/api/devices` | `admin`, `recepcionista` | equipo comercial; exige `customerId` para recepción |
| GET | `/api/repairs` | `admin`, `recepcionista`, técnico según asignación, cliente legado propio | consulta autorizada |

`POST /api/intakes` exige el header `Idempotency-Key`, de 16 a 100 caracteres seguros. Una repetición con la misma clave y payload devuelve la misma orden con HTTP 200; la misma clave con datos diferentes devuelve HTTP 409.

## Matriz de permisos de la fase

| Operación | Admin | Recepcionista | Técnico | Cliente legado |
|---|---:|---:|---:|---:|
| Registrar/consultar clientes comerciales | Sí | Sí | No | No |
| Editar datos de contacto | Sí | Sí | No | No |
| Activar/desactivar cliente | Sí | No | No | No |
| Registrar equipo comercial | Sí | Sí | No | No |
| Crear ingreso presencial y accesorios | Sí | Sí | No | No |
| Consultar órdenes presenciales | Sí | Sí | No | No |
| Consultar reparación asignada | Sí | Sí según alcance de recepción | Sí, solo asignada | Solo propia |
| Asignar técnico | Sí | No | No | No |
| Diagnóstico, presupuesto y fotografía | Sí | No | Sí, asignado | Según flujo legado |
| Administrar roles | Sí | No | No | No |

El Backend vuelve a comprobar la política en cada endpoint. Ocultar botones en el Frontend es una mejora de UX, no el control de seguridad.

## Corrección de navegación y formularios

Durante la prueba con una cuenta `admin` se detectó que el dashboard solo tenía una rama especial para `recepcionista`. Por eso el administrador seguía entrando al flujo legado: `canManageDevices(admin)` habilitaba el acceso a `/devices`, mientras que las rutas `customers` e `intakes` estaban registradas como pestañas ocultas (`href: null`) y no tenían accesos visibles desde Inicio. El formulario legado también recibía `deviceType` como texto libre y no cargaba el cliente comercial.

La integración quedó corregida sin duplicar el módulo de Fase 2:

- `admin` y `recepcionista` usan ahora el panel operativo presencial del dashboard, con accesos normales a Clientes, Nuevo cliente, Nueva recepción y Órdenes.
- La pestaña heredada Equipos no se muestra a personal interno. Si un administrador abre directamente `/devices`, la pantalla lo redirige a Clientes; el flujo legado se conserva para el rol `cliente`.
- El registro de equipo para personal interno carga clientes comerciales y exige seleccionar uno antes de guardar. La API continúa siendo la autoridad para validar la relación.
- Nueva recepción carga primero el cliente y luego únicamente sus equipos activos, evitando que se seleccione un equipo de otro cliente.
- Se incorporó el componente reutilizable `Frontend/src/components/ChoiceSelector.tsx` y las opciones controladas de `Frontend/src/constants/techfix.ts` para seleccionar tipo de equipo.
- Los textos de personal interno hablan de clientes, recepción, equipos recibidos y órdenes de servicio. El lenguaje de “mis equipos” se conserva únicamente para compatibilidad con el portal legado del rol `cliente`.
- `customerApi.list` solicita hasta 100 registros para que los selectores cubran el listado habitual de clientes sin cambiar el contrato del Backend.

El Backend no se modificó en esta corrección de interfaz: ya valida roles, cliente activo, pertenencia equipo-cliente, empleado autenticado e idempotencia de la recepción. No se ejecutaron migraciones, no se modificó MySQL y no se tocaron los datos históricos, incluido el equipo Lenovo XL1 y su reparación.

## Pruebas y estado real

Ejecutado el 28/10/2026:

- Backend `npm run typecheck`: OK.
- Backend `npm run build`: OK.
- Backend `npm test`: 16 tests unitarios OK; integración Fase 2 omitida por estar protegida por `RUN_PHASE2_INTEGRATION=true`.
- Frontend `npm run typecheck`: OK.
- Frontend `npm run lint`: OK.
- Frontend `npm test`: 6 tests OK.
- Frontend `npx expo-doctor`: 20/20 checks OK.
- Frontend `npx expo export --platform android`: verificación de bundle Android OK; no se generó APK en esta corrección.
- `005_presential_intake.sql`: aplicada primero en `techfix_phase2_20261028` y luego en `techfix`; checksum registrado `424d3b3bd1d883052aa926080b3971e30ae0f2b521c5952f1811ad7373d6fde0`.
- La base original `techfix` fue modificada únicamente por el runner oficial para aplicar 005.
- No se generó APK para esta fase.

La prueba de integración `Backend/tests/phase2.integration.test.ts` está preparada para una base nueva llamada `techfix_phase2_20261028`. Comprueba:

1. recepción de cliente, equipo e ingreso con accesorios;
2. responsable tomado de la sesión;
3. idempotencia y conflicto por reintento;
4. `403` para técnico y cliente legado en módulos comerciales;
5. técnico asignado consultando orden y equipo;
6. preservación de conteos históricos;
7. lectura de la orden creada.

Resultado real: **4/4 pruebas OK** contra `techfix_phase2_20261028`. Los datos creados por la prueba se eliminaron y se verificó que no quedaran clientes, ingresos, accesorios, notificaciones ni eventos de auditoría temporales.

## Verificación de migración e integridad

| Verificación | Fuente `techfix_restore_20261028` | Ensayo `techfix_phase2_20261028` | Original `techfix` |
|---|---:|---:|---:|
| Tablas | 24 | 27 | 27 |
| Claves foráneas | 31 | 38 | 38 |
| Migraciones registradas | 001–004 | 001–005 | 001–005 |
| Usuarios | 2 | 2 | 2 |
| Roles | 4 | 4 | 4 |
| Equipos | 1 | 1 | 1 |
| Reparaciones | 1 | 1 | 1 |
| Historiales | 1 | 1 | 1 |
| Clientes comerciales | — | 0 después de limpiar tests | — |
| Ingresos/accesorios | — | 0 después de limpiar tests | — |

Se comprobaron las columnas nullable de `devices.owner_id`, `devices.customer_id`, `repair_requests.customer_id`, `repair_requests.created_by` e `intake_idempotency_key`; los índices de cliente, creador e idempotencia; y las FKs de las tres tablas nuevas. Las consultas de huérfanos devolvieron cero para equipos-clientes, órdenes-clientes, ingresos-órdenes e ítems-ingresos.

La fuente restaurada tenía 27 eventos de auditoría al comenzar esta fase, mientras que `techfix` tenía 6. Esa diferencia preexistía antes de Fase 2; la fuente se copió sin alterarla, el ensayo conservó sus 27 eventos y los residuos nuevos de la prueba fueron eliminados.

Durante el primer intento el runner se detuvo porque el índice `idx_repairs_created_by` referenciaba un `created_at` inexistente en `repair_requests`. La versión 005 no fue registrada, se verificó que la aplicación parcial no tuviera datos, se retiraron únicamente las estructuras parciales vacías del ensayo, se corrigió el índice a `(created_by, updated_at)` y el segundo intento terminó correctamente. No se modificaron migraciones anteriores.

## Activación controlada en la base original

La activación se ejecutó el 28/10/2026 después de generar y validar un respaldo nuevo, independiente del respaldo de Fase 0, en `<RESPALDO_LOCAL_FASE2_PREACTIVACION>`.

Verificaciones previas y posteriores:

- `SELECT DATABASE()` devolvió `techfix`.
- 001–004 tenían checksums correctos y 005 no figuraba aplicada antes de iniciar.
- El respaldo cifrado AES-256-CBC + HMAC-SHA256 fue descifrado y verificado en memoria; el SQL plano se eliminó.
- El runner omitió 001–004 y aplicó únicamente 005.
- `techfix` quedó con 27 tablas y 38 claves foráneas.
- Las cinco migraciones tienen checksum coincidente con los archivos del proyecto.
- Los dos usuarios conservaron sus roles: usuario 1 `admin`, usuario 2 `tecnico`.
- El equipo Lenovo XL1, su reparación y su historial permanecen presentes.
- Las comprobaciones de integridad referencial devolvieron cero huérfanos.
- No se ejecutaron pruebas que creen o borren clientes en `techfix`.
- No se importaron datos desde las bases de ensayo.

## Preparación de la base de ensayo

La base de origen utilizada fue `techfix_restore_20261028`, ya verificada con Fase 1, y se conservó intacta. La base de destino `techfix_phase2_20261028` se derivó con el mismo estado 001–004 antes de aplicar 005.

La creación de la base vacía y la asignación de permisos se realizó manualmente en phpMyAdmin. El proceso ejecutado fue:

1. se comprobó que `techfix_app` puede crear, alterar, insertar, consultar y eliminar una tabla temporal en el destino;
2. se generó un dump temporal de la fuente, sin `CREATE/DROP/ALTER DATABASE`, `USE` ni `DROP TABLE`, y se importó en el destino;
3. se verificaron `schema_migrations` y los checksums 001–004 antes de migrar;
4. se ejecutó el runner oficial con `DB_NAME=techfix_phase2_20261028` únicamente en el proceso;
5. se confirmó que 001–004 se omitieron y 005 se aplicó;
6. se ejecutó `RUN_PHASE2_INTEGRATION=true npm test -- phase2.integration.test.ts` con 4/4 pruebas OK;
7. se compararon tablas, FKs, conteos históricos e integridad referencial.

La activación ya fue completada. No se ejecutaron migraciones posteriores ni se modificaron las bases de ensayo.

## Limitaciones conocidas

- Los selectores cargan hasta 100 clientes en una sola consulta. Para volúmenes mayores deberá incorporarse búsqueda remota o paginación visual.
- La actualización de accesorios y su devolución todavía no tiene endpoint separado; el alta se realiza dentro de la creación de la recepción. No se inicia una fase posterior con esta decisión.
- La integración funcional completa de recepción fue probada en la base de ensayo; sobre `techfix` se verificó únicamente el esquema y los datos existentes mediante lecturas, sin crear órdenes de prueba.
- OAuth, hardware Android y APK no se vuelven a probar en esta fase.

## Prueba desde Expo Go

1. Iniciá el Backend en el puerto configurado y Expo con la URL de API accesible desde el celular.
2. Reiniciá Metro con caché limpia (`npx expo start --clear`) y abrí el proyecto con Expo Go SDK 58.
3. Iniciá sesión con un usuario `admin` o `recepcionista`.
4. En Inicio verificá el bloque “Recepción presencial” y abrí “Consultar clientes”.
5. Registrá un cliente de prueba y, desde su detalle, usá “Registrar equipo del cliente”. Confirmá que tipo de equipo se elige con opciones y que no se permite guardar sin cliente.
6. Abrí “Nueva recepción”, seleccioná el cliente y verificá que el selector de equipo solo muestre sus equipos. Completá el motivo y registrá la orden.
7. Volvé a “Órdenes” y comprobá el detalle del ingreso. Para una cuenta `tecnico`, verificá que no aparezcan Clientes ni Nueva recepción y que se mantengan sus operaciones técnicas asignadas.
8. Para validar rutas directas, abrí desde el flujo de la aplicación `/customers`, `/customers/new` y `/intakes/new`; el administrador no debe volver al formulario legado de `/devices`.

La comprobación de interacción en un teléfono físico queda a cargo de la ejecución en Expo Go; el bundle y el código fueron verificados localmente, pero eso no equivale a declarar una prueba Android manual aprobada.

## Incidente de navegación en Expo Go

Durante la prueba del administrador, el botón `＋ Registrar cliente` mostraba una pantalla blanca y devolvía el flujo a Inicio. Los logs confirmaron que `/customers/new` se alcanzaba, que `hasUser` seguía siendo `true`, que el rol seguía siendo `admin` y que no existía `screen-mount` ni redirección explícita. El retorno posterior a `/`, que es la ruta inicial de `Tabs`, demostró que el destino estaba siendo resuelto dentro del navegador de pestañas y luego descartado por ese navegador.

La causa era que `customers` e `intakes` estaban declarados como hijos ocultos (`href: null`) de `Frontend/app/(app)/_layout.tsx`. En Expo Router SDK 58 esa composición no es adecuada para módulos que deben abrirse como pantallas desde el dashboard: el `Tabs` terminaba restableciendo `index`. La corrección fue mover ambos módulos a `Frontend/app/customers/` y `Frontend/app/intakes/`, bajo el `Stack` raíz, y retirar sus `Tabs.Screen`; no se agregaron anchors artificiales ni pantallas `index` falsas. Se conservaron las rutas públicas, el anchor válido de Clientes, los guards `admin`/`recepcionista`, el acceso denegado para `tecnico`/`cliente` legado y el botón Atrás.

Verificación posterior: typecheck, lint, 11 tests de Frontend y export Android completados correctamente; `expo-doctor` se ejecutará nuevamente como comprobación final. No se generó APK ni se modificaron MySQL, migraciones, datos ni roles. La interacción final aún debe comprobarse en Expo Go desde el dispositivo; no se declara resuelta en Android hasta esa confirmación.

## Instrumentación temporal de navegación

Se agregó instrumentación de desarrollo con prefijo `[TechFixNav]` en `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/index.tsx`, `AuthProvider`, el dashboard y las pantallas `customers/new` e `intakes/new`. Registra únicamente rutas, motivos, estado de carga de sesión, roles, montaje/desmontaje y resúmenes de errores; redacta valores con apariencia de tokens o credenciales. Ambas pantallas tienen un `ErrorBoundary` visible para evitar una pantalla blanca silenciosa y dejar el error en Metro. Esta instrumentación debe retirarse o desactivarse después de confirmar el diagnóstico en Expo Go.

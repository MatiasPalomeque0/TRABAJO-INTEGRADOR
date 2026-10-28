# Pruebas y verificación

## Ejecutado en el entorno actual

Fecha de esta fase: 28/10/2026.

| Comando | Resultado real |
|---|---|
| `Backend/npm run typecheck` | OK |
| `Backend/npm run build` | OK |
| `Backend/npm test` | 4 archivos, 16 tests OK; 8 pruebas de integración omitidas sin `RUN_DB_INTEGRATION=true` |
| `Frontend/npm run typecheck` | OK |
| `Frontend/npm run lint` | OK |
| `Frontend/npm test` | 2 archivos, 6 tests OK |
| `Backend/npm run typecheck` después de Fase 2 | OK |
| `Backend/npm run build` después de Fase 2 | OK |
| `Backend/npm test` después de Fase 2 | 4 archivos, 16 tests OK; integración Fase 2 omitida sin `RUN_PHASE2_INTEGRATION=true` |
| `DB_NAME=techfix_phase2_20261028 RUN_PHASE2_INTEGRATION=true npm test -- phase2.integration.test.ts` | 1 archivo, 4 tests OK; datos temporales limpiados |
| `Frontend/npx expo-doctor` | 20/20 checks OK |
| `Frontend/npx expo export --platform android` | OK; bundle Android de 1424 módulos exportado a `dist/` |
| `Frontend/npx expo start --lan --clear` | OK; Metro inició con Expo Go SDK 58 |
| `Frontend/android/gradlew.bat assembleRelease` | OK; APK SDK 58 generada para `arm64-v8a` |

## Corrección de navegación y formularios de Fase 2

| Verificación | Resultado real |
|---|---|
| Dashboard con rol `admin` | Corregido: muestra el panel operativo presencial con Clientes, Nuevo cliente, Nueva recepción y Órdenes |
| Dashboard con rol `recepcionista` | Corregido: muestra los mismos accesos presenciales sin administración de roles ni operaciones técnicas |
| Acceso directo a `/devices` con `admin` | Corregido: redirige a Clientes; el flujo legado queda disponible para `cliente` |
| Registro de equipo comercial | Corregido: selector de cliente comercial y selector controlado de tipo de equipo |
| Nueva recepción | Corregido: selector de cliente, equipos filtrados por cliente y responsable tomado de la sesión mediante la API |
| Validación Backend cliente-equipo y permisos | Conservada y revisada; la interfaz no reemplaza las comprobaciones del servidor |
| Preservación de Lenovo XL1 y reparación histórica | No se modificaron datos ni estructura; no se ejecutaron migraciones |
| `Frontend/npm run typecheck` | OK |
| `Frontend/npm run lint` | OK, sin advertencias |
| `Frontend/npm test` | OK, 6 tests |
| `Frontend/npx expo-doctor` | OK, 20/20 checks |
| `Frontend/npx expo export --platform android` | OK; bundle Android exportado; no se generó APK |
| Prueba manual en teléfono mediante Expo Go | Pendiente de ejecutar por el usuario |

La prueba manual pendiente no se marca como aprobada por la verificación estática o por el export del bundle. Debe comprobarse con usuarios reales de los roles `admin`, `recepcionista` y `tecnico`, incluyendo rutas directas y el circuito cliente → equipo → recepción → orden.

## Incidente de navegación de Clientes

| Verificación | Resultado real |
|---|---|
| Ruta declarada `Frontend/app/customers/new.tsx` | Existe y exporta pantalla válida fuera de `Tabs` |
| Protección de `admin` y `recepcionista` | Permitidos por `canManageCommercialRecords` |
| Protección de `tecnico` y `cliente` legado | Redirigidos a `/denied` |
| `customers/_layout.tsx` | `anchor: 'index'` válido porque existe `customers/index.tsx` |
| `intakes/_layout.tsx` | Anchor inválido eliminado; no existe `intakes/index.tsx` |
| Destinos del dashboard | Normalizados a `/customers`, `/customers/new`, `/intakes/new` y `/repairs` |
| Navegadores anidados | Clientes y Recepción pertenecen al `Stack` raíz; no son hijos ocultos de `Tabs` |
| Pruebas de navegación, roles y anchors | 5/5 verificaciones de navegación; suite Frontend 11/11 OK |
| Expo Doctor | 20/20 OK |
| Export Android | OK; no se generó APK |
| Prueba manual en Expo Go | Pendiente de confirmar en el dispositivo |

## Diagnóstico de la redirección silenciosa

Los logs reales mostraron que `/customers/new` sí alcanzaba el pathname y conservaba la sesión y el rol `admin`, pero no se emitía `screen-mount`. A continuación el estado volvía a `/`, la ruta inicial de `Tabs`. Esto descarta un `Redirect` del guard de sesión/rol y un error de renderizado de `customers/new.tsx`: la pantalla no llegaba a montar.

La causa concreta era la declaración de `customers` e `intakes` como hijos ocultos (`href: null`) del navegador `Tabs` definido en `Frontend/app/(app)/_layout.tsx`. Al navegar desde el dashboard a esas rutas, Expo Router SDK 58 resolvía temporalmente el pathname, pero el navegador de pestañas no podía conservar una ruta hija no tabulada y regresaba a su pantalla inicial `index` (`/`). El mismo diseño afectaba a `/intakes/new`.

La corrección fue mover ambos módulos a `Frontend/app/customers/` y `Frontend/app/intakes/`, como rutas del `Stack` raíz, y retirar sus declaraciones `Tabs.Screen`. Se conservaron las URLs públicas `/customers`, `/customers/new` e `/intakes/new`, el anchor válido de Clientes, los guards de roles y `router.back()`. La prueba de regresión verifica que no vuelvan a existir bajo `(app)` ni a declararse como tabs ocultas.

Si la pantalla blanca persiste, adjuntar el bloque de Metro generado inmediatamente después de pulsar `＋ Registrar cliente`, cualquier error rojo o stack trace mostrado por Expo Go y, si se dispone de ADB, la salida de `adb logcat -s ReactNativeJS Expo Go` durante la reproducción. No incluir tokens, contraseñas ni la URL completa con secretos.

## Instrumentación temporal de redirección silenciosa

La instrumentación de desarrollo imprime eventos con prefijo `[TechFixNav]` para `route-state`, `app-layout-state`, `navigate`, `screen-mount`, `screen-unmount`, `screen-auth-state`, `redirect`, `session-restore-*` y `render-error`. No imprime credenciales, JWT, refresh tokens ni datos del formulario. Las pantallas de Clientes y Recepción también exponen un límite de error visible para evitar que un error de renderizado quede como pantalla blanca.

La instrumentación quedó verificada por typecheck, lint, tests y export Android. La reproducción real en Expo Go sigue pendiente; no se marca como prueba Android aprobada hasta confirmar el comportamiento en el dispositivo.

Metadatos comprobados del APK local:

- Paquete: `com.techfix.app`
- Versión: `1.0.0` / `versionCode 1`
- Tamaño: `38.74 MB` (`40619509` bytes)
- SHA-256: `DEBE10517B927C751BD5CCA5809FBB0D4725D327F8E7162B1838211048B5AAA7`
- Firma: APK Signature Scheme v2 verificada con `apksigner`

## Fase 1 ejecutada contra la base de pruebas

| Comando | Resultado real |
|---|---|
| `DB_NAME=techfix_restore_20261028 npm test -- phase1.integration.test.ts` | 8/8 pruebas OK |
| `DB_NAME=techfix_restore_20261028 npm run db:migrate` | 001–003 omitidas con checksum válido; 004 aplicada |
| Verificación posterior de base | 24 tablas, 31 FKs, rol `recepcionista`, 0 invitaciones residuales |

La integración creó datos temporales únicamente en `techfix_restore_20261028` y los eliminó al finalizar. `techfix` conservó 23 tablas y sus migraciones 001–003 durante esa etapa.

## Activación de Fase 1 en `techfix`

| Verificación | Resultado real |
|---|---|
| Base seleccionada por el runner | `techfix` |
| 001–003 | Omitidas con checksum válido |
| 004 | Aplicada una sola vez |
| Usuarios antes/después | 2 / 2 |
| Equipos, reparaciones e historial antes/después | 1 / 1 / 1 |
| Roles antes/después | 3 / 4; se agregó `recepcionista` |
| Tablas y claves foráneas después | 24 / 31 |
| Integridad del historial | 0 huérfanos |

La verificación posterior fue de solo lectura. No se copiaron registros desde la base de pruebas ni se ejecutaron migraciones posteriores.

## Activación de Fase 2 en `techfix`

| Verificación | Resultado real |
|---|---|
| Conexión previa mediante `SELECT DATABASE()` | `techfix` |
| Respaldo previo nuevo | Cifrado y validado en `TechFix-Respaldos/Fase2-PreActivacion-20261028-2edbf4da`; SQL plano eliminado |
| 001–004 | Omitidas con checksum válido |
| 005 | Aplicada una sola vez |
| Tablas antes/después | 24 / 27 |
| Claves foráneas antes/después | 31 / 38 |
| Usuarios antes/después | 2 / 2 |
| Roles antes/después | 4 / 4 |
| Equipos antes/después | 1 / 1 |
| Reparaciones antes/después | 1 / 1 |
| Historiales antes/después | 1 / 1 |
| Auditoría antes/después | 6 / 6 |
| Lenovo XL1 y reparación histórica | Conservados |
| Checksums 001–005 | 5/5 coincidentes |
| Huérfanos referenciales | 0 |
| Pruebas con creación/borrado de clientes en original | No ejecutadas |

La migración se ejecutó exclusivamente mediante `npm run db:migrate` con `DB_NAME=techfix` temporal en el proceso. No se importaron registros desde las bases de ensayo y no se ejecutaron migraciones posteriores.

## Pruebas aún no ejecutadas

| Caso | Resultado esperado | Estado |
|---|---|---|
| Registro contra MySQL | 201 y cliente creado | 201 en base de pruebas |
| Correo duplicado | 409 | Pendiente de MySQL |
| Login/refresh/logout real | Tokens rotativos y revocación | Pendiente de MySQL |
| Cliente consulta otra reparación | 403 | 403 en integración Fase 1 |
| Técnico modifica reparación no asignada | 403 | Pendiente de MySQL |
| Usuario deshabilitado usa token vigente | 401 | 401 en integración Fase 1 |
| Último admin se deshabilita o pierde rol | 409 | 409 en integración Fase 1 |
| Recepcionista no accede a equipos, reparaciones, estadísticas o roles | 403 | 8/8 integración Fase 1 OK |
| Invitación usada, vencida o manipulada | 409/410/404 | 8/8 integración Fase 1 OK |
| Google/GitHub/Discord | Callback real y cuenta vinculada | Pendiente de credenciales |
| Cámara/QR/biometría/sensores | Permisos y hardware real | Pendiente de APK/dispositivo |
| APK instala y persiste sesión | Instalación y reapertura correctas | Pendiente de dispositivo ADB |
| Fase 2: migración 005 en base derivada | Solo 005 aplicada; 001–004 omitidas por checksum | OK en `techfix_phase2_20261028` |
| Fase 2: circuito cliente → equipo → ingreso → orden | 201, relaciones válidas, accesorios e historial | OK, 4/4 integración |
| Fase 2: reintento de recepción | 200 con misma clave/datos; 409 con datos distintos | OK, 4/4 integración |
| Fase 2: técnico/cliente legado sin acceso comercial | 403 en clientes, equipos comerciales e ingresos | OK, 4/4 integración |
| Fase 2: activación controlada sobre `techfix` | 005 aplicada, 27 tablas, 38 FKs y datos históricos intactos | OK; verificación posterior de solo lectura |
| Fase 3: creación concurrente de presupuestos | Una respuesta 201, otra 409 y una sola pendiente | OK, integración real 3/3 en `techfix_phase2_20261028` |
| Fase 3: dos pendientes existentes en orden #2 | Conservar ambos, reemplazar ID 1 con autorización y mantener ID 2 pendiente | OK; ambos registros conservados y un único pendiente |
| Fase 3: aprobación sin presupuesto aprobado | `en_reparacion` responde 409 | OK en integración real |
| Fase 3: técnico no puede aprobar | HTTP 403 | OK en integración real |
| Fase 3: recepción registra decisión presencial | HTTP 200 y auditoría | OK en integración real |
| Fase 3: migración 006 | Estado `reemplazado`, checksum válido y datos intactos | OK en `techfix` en la verificación previa a 007 |
| Fase 3: migración 007 en ensayo | Índice único y una sola pendiente por reparación | OK en `techfix_phase2_20261028` |
| Fase 3: activación 007 en original | 001–006 omitidas, 007 aplicada con checksum válido | OK en `techfix`; respaldo protegido y runner limitado a 007 |
| Fase 3: resolución administrativa | ID 1 reemplazado, ID 2 pendiente, auditoría atómica | OK en `techfix`; evento 14 |
| Fase 3: integridad posterior a 007 | 27 tablas, 38 FKs, 0 duplicados pendientes, 0 huérfanos verificados | OK en `techfix`; conteos históricos conservados |
| Fase 4: migración 008 en ensayo | Decisiones, trabajo y entregas creados sin modificar datos históricos | OK en `techfix_phase2_20261028`; 001–007 omitidas y 008 aplicada |
| Fase 4: activación 008 en original | 001–007 omitidas, 008 aplicada con checksum válido y sin datos funcionales nuevos | OK en `techfix`; respaldo protegido y runner limitado a 008 |
| Fase 4: decisión presencial | Técnico 403; admin/recepción 200; segunda decisión 409; auditoría | OK, integración MariaDB 3/3 |
| Fase 4: inicio y trabajo | Sin aprobación 409; sin trabajo documentado 409; técnico asignado puede registrar trabajo | OK, integración MariaDB 3/3 |
| Fase 4: entrega presencial | Estado `entregado`, accesorios devueltos, reintento 200 y clave distinta 409 | OK, integración MariaDB 3/3 |
| Fase 4: integridad | 30 tablas, 44 FKs, 0 decisiones huérfanas, 0 entregas huérfanas | OK en ensayo y `techfix` |

## Corrección de interfaz Android de Fase 4 — verificación estática

| Caso | Resultado esperado | Resultado real |
|---|---|---|
| Detalle real de reparación | Expo Router usa `app/(app)/repairs/[id].tsx` | Confirmado por estructura de rutas y export Android |
| Decisión presencial para administrador | Ve presupuesto vigente, observación, Aprobar/Rechazar e historial | Cubierto por `PresentialEstimateCard` y typecheck/lint/tests |
| Decisión presencial para recepcionista | Puede registrar decisión presencial; no ve acciones técnicas | Cubierto por pruebas de visibilidad y permisos de la pantalla |
| Decisión para técnico | No puede aprobar ni rechazar | Cubierto por prueba automatizada; Backend conserva 403 |
| Presupuesto pendiente | No se muestra formulario de creación duplicada | Cubierto por `canCreateEstimate(1) === false` y prueba automatizada |
| Orden #2 en diagnóstico con presupuesto pendiente | No ofrece `En reparación` | Cubierto por `allowedRepairStatuses` con contexto y prueba automatizada |
| Finalización sin trabajo documentado | No ofrece `Reparación finalizada` | Cubierto por prueba automatizada |
| Entrega | No aparece en selector genérico; solo por flujo presencial | Cubierto por `allowedRepairStatuses` y ruta de entrega existente |
| Bundle Android | Compila sin errores de rutas/componentes | `npx expo export --platform android`: OK |
| Prueba manual en Expo Go | Confirmar visualmente en Android | Pendiente de confirmación del usuario |

## Actualización de órdenes — foco y pull-to-refresh

| Caso | Resultado esperado | Resultado real |
|---|---|---|
| Recuperar foco en `repairs/index.tsx` | Solicitar nuevamente las órdenes al Backend | Implementado con `useFocusEffect` |
| Pull-to-refresh | Mostrar indicador y reemplazar la lista con la respuesta actual | Implementado con `RefreshControl` |
| Error durante recarga | Conservar la lista anterior y mostrar reintento | Implementado |
| Foco y pull simultáneos | Una sola solicitud en vuelo | 2/2 pruebas `single-flight` aprobadas |
| Crear, modificar o entregar y volver a la lista | Mostrar el estado devuelto por Backend | Cubierto por la recarga al recuperar foco |
| Frontend typecheck | Sin errores TypeScript | Aprobado |
| Frontend lint | Sin errores ni warnings | Aprobado |
| Frontend tests | Todas las pruebas aprobadas | 22/22 aprobadas |
| Verificación visual Android | Confirmar `Entregado` sin cerrar Expo Go | Pendiente de prueba manual |

No se marca una integración externa como aprobada solo por compilar el código.

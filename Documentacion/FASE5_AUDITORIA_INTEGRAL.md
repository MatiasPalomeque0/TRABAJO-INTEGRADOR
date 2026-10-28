# TECHFIX — FASE 5: AUDITORÍA INTEGRAL

**Fecha de auditoría:** 2026-10-28  
**Alcance:** Frontend React Native/Expo SDK 58, Backend Express/TypeScript, migraciones y documentación del repositorio.  
**Modalidad:** auditoría estática y pruebas no destructivas.  
**Restricciones respetadas:** no se modificó código funcional, no se ejecutaron migraciones, no se escribieron datos en `techfix`, no se crearon ni eliminaron usuarios u órdenes, no se generó una APK y no se realizó ningún commit.

## 1. Resumen ejecutivo

TechFix cuenta con una base técnica sólida para el circuito presencial: Frontend Expo Router con TypeScript, Backend Express con capas de rutas/controladores/servicios/repositorios, autenticación JWT, roles, migraciones versionadas, MariaDB, validaciones Zod, auditoría, idempotencia en operaciones críticas y documentación de las fases anteriores.

Las verificaciones automatizadas realizadas en esta auditoría fueron exitosas para TypeScript, ESLint, build del Backend, pruebas unitarias, `expo-doctor`, export Android y las suites de integración de las Fases 2, 3 y 4 sobre la base de ensayo. La suite de Fase 1 no pudo ejecutarse porque el usuario `techfix_app@localhost` no tenía permisos sobre `techfix_restore_20261028`; el error ocurrió antes de iniciar los tests y no produjo modificaciones.

No corresponde declarar el proyecto listo para entrega final. Se detectaron riesgos relevantes que deben corregirse antes de afirmar cumplimiento integral:

- Los endpoints de diagnóstico, presupuesto y fotografía todavía admiten mutaciones técnicas cuando la orden ya está entregada o cerrada; la interfaz también deja visibles acciones técnicas en ese estado.
- Las transiciones de estado y la asignación de técnicos tienen ventanas de concurrencia entre la comprobación y la actualización.
- Una renovación de sesión fallida puede dejar al Frontend mostrando un usuario autenticado aunque el refresh token haya sido revocado o haya expirado.
- El flujo OAuth está implementado en código, pero no fue verificado con credenciales reales de Google, GitHub y Discord.
- No se verificó instalación ni ejecución de la APK en un dispositivo durante esta auditoría. El export Android fue exitoso, pero no equivale a una instalación real.
- La auditoría de dependencias del Frontend informa vulnerabilidades transitivas; no se aplicó `npm audit fix --force` porque propone cambios incompatibles con la versión de Expo y de Vitest.

### Resultado cuantitativo conservador

Se agruparon los requisitos obligatorios en 30 áreas verificables:

| Resultado | Cantidad | Porcentaje |
|---|---:|---:|
| Comprobado completamente | 14 | 46,7 % |
| Parcialmente comprobado | 11 | 36,7 % |
| Pendiente de verificación o configuración | 5 | 16,7 % |
| **Total** | **30** | **100 %** |

El porcentaje indica requisitos agrupados comprobados con la evidencia disponible; no es una medida de calidad general ni autoriza a declarar el producto terminado.

## 2. Fuentes y método

Se revisaron:

- `README.md`.
- `Documentacion/ANALISIS_IMPACTO_TECHFIX.md`.
- `Documentacion/MATRIZ_REQUISITOS.md`.
- `Documentacion/PRUEBAS.md`.
- `Documentacion/FASE2_RECEPCION.md`.
- `Documentacion/FASE3_GESTION_TECNICA.md`.
- `Documentacion/FASE4_ENTREGAS.md`.
- `Frontend/package.json`, `Frontend/package-lock.json`, configuración Expo/Android y rutas de `Frontend/app`.
- `Backend/package.json`, `Backend/package-lock.json`, servidor, middleware, rutas, controladores, servicios, repositorios, migraciones, tests y OpenAPI.

No se encontró en el repositorio un archivo independiente que contenga la consigna original completa. El análisis de impacto y la matriz de requisitos son las fuentes internas más cercanas; por eso las conclusiones sobre requisitos se marcan como comprobadas, parciales o pendientes según el código y la evidencia actual, sin tomar afirmaciones históricas de documentación como prueba suficiente.

La auditoría de base de datos no ejecutó escrituras ni migraciones. No se imprimieron secretos, contraseñas, JWT, refresh tokens ni valores de `.env`.

## 3. Matriz de cumplimiento de requisitos

| # | Requisito agrupado | Evidencia actual | Estado |
|---:|---|---|---|
| 1 | React Native, Expo SDK 58 y TypeScript | `Frontend/package.json`, Expo Router 58, React Native y typecheck exitoso | **Completo** |
| 2 | Componentes, hooks y estado global con Context API | `Frontend/src/context`, hooks y providers; typecheck y tests exitosos | **Completo** |
| 3 | Formularios con React Hook Form y Zod | Formularios de clientes, recepción, diagnóstico y presupuesto; typecheck exitoso | **Completo** |
| 4 | SecureStore y persistencia de sesión/preferencias | `storage.ts`, `auth-context.tsx`, SecureStore y preferencias persistidas | **Completo en código** |
| 5 | Navegación con Expo Router y protección de rutas | layouts, tabs, guards y `route-integrity.test.ts` | **Completo en código** |
| 6 | Consumo REST, timeout, refresh y manejo de errores | `Frontend/src/services/api.ts` y servicios de dominio | **Completo en código** |
| 7 | Backend Express/TypeScript y API REST | servidor, rutas, controladores, servicios y build exitoso | **Completo** |
| 8 | MariaDB, migraciones versionadas y normalización | migraciones 001–008, documentación y estructura relacional | **Completo en código/documentación** |
| 9 | CRUD y circuito presencial | suite Fase 2: 5/5 sobre base de ensayo | **Completo en ensayo** |
| 10 | Roles internos y autorización diferenciada | middleware, políticas y suites Fases 2–4 | **Completo en ensayo/código** |
| 11 | Registro, login y logout tradicional verificados actualmente | implementación presente; suite Fase 1 bloqueada por permisos de la base de ensayo | **Pendiente** |
| 12 | JWT de acceso, refresh, rotación y revocación | implementación presente, con riesgo de concurrencia y sesión Frontend stale | **Parcial** |
| 13 | OAuth real Google, GitHub y Discord | código PKCE/state/callback; no hay prueba con credenciales reales | **Pendiente** |
| 14 | Hash de contraseñas, validaciones y SQL parametrizado | bcryptjs, Zod, consultas parametrizadas y tests | **Completo en código** |
| 15 | Rate limiting y protección contra abuso | límites globales y de autenticación configurados; no hay prueba de carga | **Parcial** |
| 16 | Auditoría, transacciones e idempotencia | decisiones, entregas, presupuestos y recepción; suites Fases 2–4 exitosas | **Completo en ensayo** |
| 17 | CORS, HTTPS y TLS de base remota | CORS por allowlist; HTTPS/TLS dependen de configuración de despliegue | **Parcial** |
| 18 | Notificaciones dentro de la aplicación | tabla, endpoints y pantallas de notificaciones | **Completo en código** |
| 19 | Cámara y fotografías de evidencia | rutas nativas y carga de evidencia existentes; hardware y flujo final no verificados | **Pendiente** |
| 20 | Lectura QR con autorización en Backend | lector y validación de recurso; no verificado en dispositivo real | **Pendiente** |
| 21 | Biometría para desbloqueo local | SecureStore/biometría implementados; no verificación manual y semántica de logout por definir | **Parcial** |
| 22 | Ubicación GPS en contexto permitido | ubicación foreground y apertura de ubicación del local; no verificación de dispositivo | **Parcial** |
| 23 | Acelerómetro y giroscopio | pantalla de demostración y cleanup de listeners; no verificación de hardware | **Parcial** |
| 24 | Tema claro, oscuro y sistema | `theme-context.tsx`, persistencia y pantallas | **Completo en código** |
| 25 | Responsive, teclado Android, accesibilidad y UX manual | `Screen`, KAV, refresh y validaciones; requiere verificación en dispositivo | **Parcial** |
| 26 | Estados, presupuesto, reparación y entrega presencial | integración Fase 4 exitosa, pero hay mutaciones técnicas después de entrega | **Parcial** |
| 27 | APK/EAS, instalación y operación en Android | export Android exitoso y configuración EAS; instalación/uso final no verificados en esta auditoría | **Pendiente** |
| 28 | Documentación, OpenAPI y matriz de requisitos | documentación amplia; OpenAPI y matriz necesitan sincronización | **Parcial** |
| 29 | Testing automatizado | unitarios y Fases 2–4; Fase 1 bloqueada y sin suite UI/hardware completa | **Parcial** |
| 30 | Git, `.gitignore` y entrega reproducible | `.gitignore` adecuado; estado de trabajo con cambios y sin commit de esta auditoría | **Parcial** |

## 4. Verificaciones ejecutadas

### Backend

| Comprobación | Resultado real |
|---|---|
| `npm run typecheck` | **OK**, exit 0 |
| `npm run build` | **OK**, exit 0 |
| `npm test -- --run` | **OK**, 4 archivos y 16 tests pasaron |
| Integraciones Fase 2 | **OK**, 5/5 sobre `techfix_phase2_20261028` |
| Integraciones Fase 3 | **OK**, 3/3 sobre base de ensayo |
| Integraciones Fase 4 | **OK**, 3/3 sobre base de ensayo |
| Integración Fase 1 | **No ejecutable**, acceso denegado a `techfix_restore_20261028` antes del setup; 0 escrituras |
| `npm audit --omit=dev --audit-level=moderate` | **OK**, 0 vulnerabilidades reportadas |

Las suites de Fases 2–4 se ejecutaron con sus flags de integración y base de ensayo. No se usó la base original `techfix` para crear ni eliminar fixtures.

### Frontend

| Comprobación | Resultado real |
|---|---|
| `npm run typecheck` | **OK**, exit 0 |
| `npm run lint` | **OK**, exit 0, sin warnings |
| `npm test -- --run` | **OK**, 7 archivos y 22 tests pasaron |
| `npx expo-doctor` | **OK**, 20/20 checks pasaron |
| `npx expo export --platform android` | **OK**, Metro compiló 1446 módulos y exportó `dist` |
| `npm audit --omit=dev --audit-level=moderate` | **Riesgo**, 8 vulnerabilidades: 5 low y 3 high |
| Auditoría Frontend incluyendo devDependencies | **Riesgo**, 15 vulnerabilidades: 9 low, 1 moderate, 3 high y 2 critical |

El export Android demuestra que Metro puede generar el bundle; no demuestra instalación, permisos, OAuth, conectividad desde un teléfono ni ejecución de sensores/cámara/biometría.

### Dependencias

El Backend no reportó vulnerabilidades con dependencias de producción. El Frontend tiene avisos transitivos, entre ellos:

- `zod <4.6.6`, advisory de agotamiento de memoria ante colecciones restringidas.
- `deepmerge`, advisory de prototype poisoning.
- En herramientas de desarrollo/test aparece `tinypool <=2.1.1`, reportado como riesgo crítico de prototype pollution/RCE.

`npm audit fix --force` no se ejecutó. La propuesta incluye cambios incompatibles, entre ellos downgrade a Expo 51 o actualización mayor de Vitest; debe evaluarse en una rama de mantenimiento separada y con pruebas de compatibilidad.

## 5. Auditoría funcional

### Autenticación y sesión

La autenticación local usa validación, bcrypt, JWT de acceso corto y refresh tokens almacenados como hash. El Backend vuelve a cargar el usuario en cada request autenticada y rechaza usuarios inactivos. El Frontend restaura la sesión desde SecureStore y puede usar biometría para desbloquear una sesión local ya existente.

La implementación está presente, pero la verificación actual del flujo completo quedó limitada porque la suite de Fase 1 no pudo obtener acceso a la base de ensayo. Además, el refresh del Frontend no notifica de forma centralizada al `AuthProvider` cuando falla la renovación, por lo que la interfaz puede conservar temporalmente el usuario anterior.

El flujo OAuth de los tres proveedores está preparado con state, PKCE, redirect móvil, secretos en Backend, comprobación de correo verificado y handoff de un solo uso. No se verificó una autenticación real con cuentas de proveedor ni la configuración de credenciales del entorno final.

### Clientes, equipos y recepción

La suite de Fase 2 pasó 5/5 pruebas sobre MariaDB de ensayo: recepcionista registra cliente, equipo, recepción, accesorios y orden; se validan relaciones, permisos e idempotencia. El técnico queda fuera de las operaciones comerciales y la autorización se aplica en Backend.

El circuito de recepción está disponible en la navegación de personal y se conservan las relaciones heredadas de equipos y reparaciones. La revisión de Android de esta auditoría queda pendiente.

### Asignación, diagnósticos y estados

La asignación valida técnico activo con rol técnico y restringe la acción al administrador. La consulta de reparaciones se filtra por asignación para técnicos. Los diagnósticos están disponibles para administrador o técnico asignado.

Hay dos riesgos importantes: la asignación comprueba el técnico y actualiza después sin una única operación bloqueada; y las precondiciones de estado se validan en el controlador antes de que el repositorio tome el lock de la reparación. Bajo concurrencia pueden pasar dos operaciones basadas en el mismo estado anterior.

### Presupuestos y decisiones presenciales

La migración 007 y el servicio de creación evitan más de un presupuesto pendiente por reparación mediante transacción, lock y restricción única. Las suites de Fase 3 pasaron. La Fase 4 registra decisión presencial, actor, fecha, canal y auditoría; la entrega valida el estado, los accesorios y la idempotencia.

El presupuesto vigente y los históricos se separan en el detalle de orden. El problema restante no es la duplicación de presupuestos, sino el cierre de las mutaciones técnicas después de la entrega, detallado en F5-01.

### Entrega e historial

La entrega presencial exige administrador o recepcionista, orden lista, empleado, persona que retira, fecha, observaciones y accesorios. La transacción impide entregas duplicadas y registra historial/auditoría. La integración de Fase 4 pasó 3/3 en ensayo.

La lista de órdenes fue actualizada previamente para refrescar al recuperar foco y mediante pull-to-refresh, conservando datos anteriores si falla una recarga. La prueba automatizada de utilitario pasó; la comprobación visual de foco y gesto debe realizarse en Expo Go.

## 6. Auditoría de interfaz y navegación

Aspectos comprobados en código:

- Expo Router tiene layouts raíz, grupo de aplicación, tabs y rutas de clientes/recepción.
- Existe prueba de integridad de rutas y no se detectaron anchors inválidos en la revisión actual.
- Los accesos de administración, recepción y técnico se filtran por rol en Frontend y vuelven a validarse en Backend.
- El componente `Screen` centraliza Safe Area, `KeyboardAvoidingView`, ScrollView, `keyboardShouldPersistTaps` y refresh control.
- El tema claro/oscuro/sistema se mantiene por Context y almacenamiento local.
- El detalle de reparación muestra acciones relacionadas con el estado y oculta la entrega del selector genérico.
- La lista de órdenes recarga al recuperar foco y mediante pull-to-refresh.

Aspectos que requieren corrección o validación adicional:

- El detalle de orden todavía muestra diagnóstico, presupuesto y fotografía a administrador/técnico aunque la orden esté entregada; además el Backend no bloquea esas mutaciones por estado.
- No existe una suite de componentes que pruebe navegación, guards, carga, error, roles y visibilidad de acciones en pantallas reales; los tests actuales cubren utilitarios y rutas.
- `Frontend/app/(app)/settings.tsx:7` todavía muestra “Expo SDK 57”, aunque el proyecto usa SDK 58.
- La pantalla de ubicación usa la dirección fija `Av. Siempre Viva 742`; debe confirmarse si es una dirección deliberadamente ficticia para la defensa o si se requiere una configuración del local.
- Los formularios de orden/recepción y los módulos nativos fueron analizados estáticamente, pero no se verificaron en todas las resoluciones, orientación, teclado, permisos rechazados y dispositivos sin hardware.

## 7. Auditoría de seguridad

### Controles favorables

- Contraseñas con bcryptjs, costo configurado, nunca se almacenan en texto plano.
- JWT de acceso con expiración corta y refresh token aleatorio almacenado como hash.
- Middleware de autenticación vuelve a consultar el usuario y rechaza cuentas deshabilitadas.
- Middleware de roles responde 401/403 según corresponda.
- Consultas SQL parametrizadas; no se encontró una inyección SQL confirmada en la revisión.
- Helmet, CORS por allowlist, rate limiting global y límite específico para autenticación.
- Errores internos devuelven mensajes genéricos y no exponen tokens ni credenciales.
- Operaciones críticas de decisión, entrega, presupuesto y recepción usan transacciones o controles de idempotencia.
- Los secretos OAuth están configurados en Backend y no en la APK.

### Riesgos

La configuración de producción debe exigir HTTPS para API y TLS para MariaDB remota. Actualmente `PUBLIC_BASE_URL` tiene fallback de localhost y `DB_SSL` queda desactivado si no se configura. El Frontend también tiene fallback de API a `http://localhost:4000/api`; una APK creada sin la variable correcta puede intentar conectarse al propio teléfono.

El refresh token rotation debe hacerse bajo lock y con actualización condicional. El estado OAuth debe reclamarse de forma atómica antes de iniciar el intercambio remoto. Las fotografías deben protegerse con límites de tamaño/tipo y una estrategia de almacenamiento/descarga autenticada; actualmente se almacenan como base64 en `LONGTEXT` y el detalle solo expone metadatos.

## 8. Hallazgos priorizados

### F5-01 — ALTO — Mutaciones técnicas después de una orden entregada — corregido en Fase 5.1

- **Evidencia:** `Frontend/app/(app)/repairs/[id].tsx:148-153`, `:172-185` y el control de fotografía cercano al final del detalle; `Backend/src/controllers/repair.controller.ts` en las operaciones de diagnóstico, presupuesto y fotografía.
- **Función afectada:** renderizado de acciones técnicas y controladores `addDiagnosis`, `createEstimate` y `addRepairPhoto`.
- **Impacto:** una orden ya entregada puede recibir diagnóstico, presupuesto o fotografía nuevos, rompiendo la trazabilidad del circuito presencial.
- **Corrección recomendada:** definir estados cerrados, aplicar la restricción en Backend dentro de cada endpoint y ocultar/deshabilitar las mismas acciones en Frontend. Agregar pruebas 403/409 y regresión específica para `entregado`, `cancelado` y, según la política, `listo_para_retirar`.
- **Prioridad:** P0.
- **Estado posterior:** corregido en Backend y Frontend; verificado en ensayo con la suite de Fase 5.1. La comprobación manual desde Android continúa pendiente.

### F5-02 — ALTO — Ventana de concurrencia en transiciones de reparación

- **Evidencia:** el controlador valida estado y precondiciones antes de llamar al repositorio; `Backend/src/repositories/repair.repository.ts:97-103` bloquea la fila posteriormente, sin repetir todas las validaciones bajo el lock.
- **Función afectada:** actualización de estado de reparación.
- **Impacto:** dos solicitudes simultáneas pueden pasar una comprobación basada en el mismo estado y dejar una secuencia inválida o contradictoria.
- **Corrección recomendada:** mover la lectura, lock, validación de transición, precondiciones y escritura a una única transacción; rechazar con 409 cuando el estado cambió.
- **Prioridad:** P0.
- **Estado posterior:** corregido en Fase 5.2; la suite real contra `techfix_phase2_20261028` verificó carreras de estados, precondiciones obsoletas y rollback de auditoría. Ver `Documentacion/FASE5_2_CONCURRENCIA.md`.

### F5-03 — ALTO — Sesión Frontend stale después de fallar el refresh

- **Evidencia:** `Frontend/src/services/api.ts:36-40` reintenta luego de 401 y lanza error si refresh falla, pero no limpia SecureStore ni notifica al `AuthProvider`; `Frontend/src/context/auth-context.tsx:20-26` conserva el usuario hasta otro evento.
- **Función afectada:** interceptor/servicio de API y estado global de autenticación.
- **Impacto:** la UI puede mostrar una sesión aparentemente válida después de revocación o expiración y repetir solicitudes fallidas.
- **Corrección recomendada:** centralizar un evento de sesión expirada que limpie tokens, usuario y estado de autenticación; evitar ciclos de refresh y navegar al login solo después de limpiar estado.
- **Prioridad:** P0.

### F5-04 — ALTO — Rotación de refresh tokens vulnerable a solicitudes concurrentes

- **Evidencia:** `Backend/src/services/auth.service.ts:43-60` lee el refresh token fuera de una transacción y no usa `FOR UPDATE` ni una actualización condicional que garantice que solo una solicitud lo revoque.
- **Función afectada:** `refreshSession`.
- **Impacto:** dos solicitudes concurrentes con el mismo token pueden superar la comprobación y generar más de una rotación válida.
- **Corrección recomendada:** transacción con `SELECT ... FOR UPDATE`, comprobar nuevamente expiración/revocación y actualizar con `WHERE revoked_at IS NULL`; rechazar si `affectedRows` no es uno.
- **Prioridad:** P1.

### F5-05 — ALTO — Configuración insegura por fallback de localhost/HTTP

- **Evidencia:** `Frontend/src/constants/config.ts:1` usa `http://localhost:4000/api` si falta la variable; `Backend/src/config/env.ts` permite `PUBLIC_BASE_URL` localhost; `Backend/src/config/db.ts` activa TLS solo con `DB_SSL=true`.
- **Impacto:** una release puede quedar sin conexión desde Android o transmitir tráfico sin las garantías esperadas; una API remota mal configurada puede usar transporte inseguro.
- **Corrección recomendada:** fallar al iniciar una build de producción si falta `EXPO_PUBLIC_API_URL` o no es HTTPS; exigir HTTPS en `PUBLIC_BASE_URL`; exigir TLS para MariaDB remota y validar certificados.
- **Prioridad:** P0 para una entrega pública; P1 para entorno escolar local controlado.

### F5-06 — MEDIO — Reutilización concurrente del estado OAuth y vinculación automática por correo

- **Evidencia:** `Backend/src/services/oauth.service.ts:74-100` consulta el estado y realiza el intercambio remoto antes de una reclamación atómica; también vincula una identidad OAuth a un usuario existente por correo verificado.
- **Impacto:** callbacks concurrentes pueden producir más de un handoff; el vínculo automático por correo requiere una política explícita para evitar asociaciones inesperadas.
- **Corrección recomendada:** reclamar/eliminar el estado de forma atómica con lock y constraint; documentar y, si corresponde, exigir una vinculación explícita para cuentas existentes.
- **Prioridad:** P1.

### F5-07 — MEDIO — Suite de Fase 1 bloqueada por permisos de la base de ensayo

- **Evidencia:** `RUN_DB_INTEGRATION=true` contra `techfix_restore_20261028` terminó con “Access denied” para `techfix_app@localhost` antes del setup.
- **Impacto:** registro/login/invitaciones/sesiones de esa fase no tienen una ejecución actual comparable con las demás fases.
- **Corrección recomendada:** otorgar al usuario de ensayo solo los permisos necesarios o preparar otra base independiente; repetir la suite y registrar el resultado.
- **Prioridad:** P1.

### F5-08 — MEDIO — OAuth, hardware, APK e instalación no verificados en forma manual

- **Evidencia:** solo se realizó export Android y `expo-doctor`; no hubo instalación ADB ni prueba actual con proveedores OAuth, cámara, QR, biometría, ubicación o sensores.
- **Impacto:** no se puede afirmar que la entrega final funciona en Android real.
- **Corrección recomendada:** generar una nueva APK con API remota HTTPS, instalarla en un dispositivo y ejecutar la matriz manual de flujos y permisos.
- **Prioridad:** P1.

### F5-09 — MEDIO — Evidencias fotográficas almacenadas como base64 sin consulta de imagen

- **Evidencia:** repositorio de reparaciones y migración de evidencias usan `LONGTEXT`; `Frontend/app/native/repair-photo.tsx` carga base64, mientras el detalle muestra metadatos/contador y no existe un endpoint de descarga autenticada equivalente.
- **Impacto:** crecimiento de base, mayor costo de red, falta de consulta de evidencia y riesgo de exposición si se agrega una descarga sin autorización.
- **Corrección recomendada:** validar MIME/tamaño, almacenar fuera de tablas transaccionales o definir endpoint privado con control de reparación/rol y URLs de corta duración.
- **Prioridad:** P1/P2.

### F5-10 — MEDIO — Cobertura insuficiente de UI y guards

- **Evidencia:** la suite Frontend actual cubre siete archivos y 22 tests, principalmente utilitarios, rutas y single-flight; no hay cobertura equivalente de formularios, guards, estados de carga/error y visibilidad por rol en pantallas.
- **Impacto:** regresiones de navegación o visibilidad pueden llegar a Android aunque TypeScript y ESLint pasen.
- **Corrección recomendada:** agregar tests con React Native Testing Library para login, dashboard por rol, detalle de orden, formularios, refresh, rutas restringidas y estados terminales.
- **Prioridad:** P1.

### F5-11 — BAJO — Etiqueta obsoleta de SDK

- **Evidencia:** `Frontend/app/(app)/settings.tsx:7` muestra “Expo SDK 57” aunque el paquete y `expo-doctor` corresponden a SDK 58.
- **Impacto:** información incorrecta para el usuario y la defensa del proyecto.
- **Corrección recomendada:** actualizar el texto y agregar una comprobación de versión en documentación.
- **Prioridad:** P2.

### F5-12 — BAJO/MEDIO — Roles y módulos heredados fuera del alcance actual

- **Evidencia:** `Backend/src/types/domain.ts` conserva `coordinador` y `usuario`; controladores de proyectos/tareas siguen usando esos roles, aunque no forman parte del catálogo operativo actual y algunas tabs están ocultas.
- **Impacto:** superficie de API innecesaria, confusión en la matriz de permisos y posible mantenimiento de rutas que no tienen flujo visible.
- **Corrección recomendada:** documentar/deprecar explícitamente esos módulos o retirarlos solo después de verificar dependencias y compatibilidad histórica.
- **Prioridad:** P2.

### F5-13 — BAJO/MEDIO — Dirección del local hardcodeada

- **Evidencia:** `Frontend/app/native/local-location.tsx:7-8` usa `Av. Siempre Viva 742` y una URL fija.
- **Impacto:** la aplicación puede mostrar información ficticia o incorrecta en la entrega escolar.
- **Corrección recomendada:** configurar la dirección como valor documentado y validado, o marcar explícitamente que es un dato de demostración.
- **Prioridad:** P2.

### F5-14 — BAJO — Documentación y OpenAPI parcialmente desincronizados

- **Evidencia:** README, matriz y `PRUEBAS.md` contienen resultados históricos junto con pendientes actuales; el OpenAPI manual no documenta con igual detalle todos los schemas, errores y permisos.
- **Impacto:** el profesor puede interpretar como verificado un flujo que solo está implementado o probado en ensayo.
- **Corrección recomendada:** separar “implementado”, “probado en ensayo”, “probado en Android” y “pendiente”; completar schemas, 401/403/409/422 y roles en OpenAPI.
- **Prioridad:** P2.

### F5-15 — MEDIO — Restauración de sesión vulnerable a JSON corrupto

- **Evidencia:** `Frontend/src/context/auth-context.tsx` obtiene la sesión antes de entrar al `try` que protege la restauración.
- **Impacto:** un valor corrupto en SecureStore puede impedir finalizar el estado de carga y dejar la navegación en un estado inconsistente.
- **Corrección recomendada:** envolver la lectura y el parseo completo en `try/catch`, limpiar el almacenamiento corrupto y finalizar siempre `isLoading`.
- **Prioridad:** P1/P2.

### F5-16 — BAJO — Preferencia biométrica persistente después de logout

- **Evidencia:** `Frontend/src/services/storage.ts` guarda la habilitación biométrica y `clearSession()` no la elimina.
- **Impacto:** puede quedar activa una preferencia del dispositivo anterior después de cerrar sesión; no es una elevación de privilegios porque el Backend sigue validando tokens, pero la semántica puede sorprender.
- **Corrección recomendada:** decidir y documentar si la preferencia es del dispositivo o de la cuenta; limpiar o volver a asociar la preferencia según esa decisión.
- **Prioridad:** P2.

### F5-17 — MEDIO — Idempotencia de recepción no traduce toda carrera a 409

- **Evidencia:** la recepción exige idempotency key y usa restricción única/transacción, pero una colisión concurrente de índice puede propagarse como error genérico si no se captura explícitamente `ER_DUP_ENTRY`.
- **Impacto:** una solicitud duplicada puede devolver 500 en lugar de una respuesta comprensible 409 o del recurso ya creado.
- **Corrección recomendada:** capturar la violación de unicidad, consultar la recepción asociada a la key y responder de forma idempotente o con 409.
- **Prioridad:** P1.

### F5-18 — MEDIO — Carrera en asignación de técnico

- **Evidencia:** el repositorio valida rol/estado activo y actualiza la asignación en operaciones separadas.
- **Impacto:** un técnico podría ser deshabilitado entre la validación y la escritura, dejando una asignación que contradice la política.
- **Corrección recomendada:** bloquear usuario y reparación dentro de la misma transacción, revalidar activo/rol y registrar la auditoría junto con la asignación.
- **Prioridad:** P1.
- **Estado posterior:** corregido en Fase 5.2; la asignación bloquea primero la reparación, luego valida el técnico activo y registra la auditoría dentro de la misma transacción. La carrera de dos asignaciones devolvió `200/409` en ensayo.

### F5-19 — MEDIO/BAJO — Listados sin paginación uniforme

- **Evidencia:** los listados de reparaciones/tareas y algunos recursos consultan colecciones completas; la consigna original solicita paginación cuando corresponda.
- **Impacto:** degradación de rendimiento cuando crezcan órdenes, clientes o historiales.
- **Corrección recomendada:** agregar `limit`, `cursor` o `page`, límites máximos y metadatos; conservar filtros autorizados.
- **Prioridad:** P2.

### F5-20 — ALTO para cadena de desarrollo — Vulnerabilidades transitivas del Frontend

- **Evidencia:** `npm audit` del Frontend reporta 8 vulnerabilidades de producción potenciales, 3 high, y 15 incluyendo desarrollo, con 2 critical; la corrección automática forzada propone cambios mayores incompatibles.
- **Impacto:** riesgo de cadena de suministro, especialmente en tooling de tests; el resultado no prueba por sí solo explotación en el APK final.
- **Corrección recomendada:** actualizar dependencias en una rama controlada, revisar lockfile, repetir Expo Doctor/typecheck/tests/export y separar dependencias de runtime de tooling. No usar `--force` sin revisar el impacto.
- **Prioridad:** P1.

## 9. Arquitectura y mantenibilidad

### Fortalezas

- Separación razonable entre rutas, controladores, servicios, repositorios, validadores y tipos.
- Política de permisos centralizada en Backend y utilidades equivalentes en Frontend.
- Runner de migraciones versionado con checksums y límite de versión utilizable para activaciones controladas.
- Componentes de UI reutilizables y un `Screen` común para teclado, safe area y scroll.
- Se observan archivos de tamaño razonable en la mayoría del proyecto. El repositorio de reparaciones y el detalle de orden son los puntos más densos, pero no constituyen por sí solos un defecto crítico.

### Deuda técnica

- Las reglas de rol existen en Backend y Frontend; deben mantenerse sincronizadas mediante una matriz o contrato compartido para reducir divergencias.
- El detalle de reparaciones concentra presupuesto, diagnóstico, historial, trabajo, evidencias y entrega; conviene extraer secciones presentacionales y un selector de acciones por estado, sin fragmentar la lógica de dominio.
- Los módulos heredados de proyectos/tareas y roles `coordinador`/`usuario` agregan superficie que no corresponde al alcance presencial actual.
- OpenAPI se construye manualmente y puede quedar desactualizado frente a las rutas reales; conviene validar o generar schemas a partir de contratos.
- Los listados sin paginación y las imágenes en `LONGTEXT` no son un problema para el volumen escolar actual, pero limitan la escalabilidad.

No se detectaron funciones con evidencia suficiente para afirmar que son código muerto; los módulos heredados deben ser inventariados antes de eliminarlos.

## 10. Funcionalidades verificadas, parciales y pendientes

### Verificadas en código y/o ensayo

- Roles de administrador, recepcionista, técnico y cliente legado en las rutas principales.
- Clientes comerciales, equipos, ingresos, accesorios y órdenes presenciales.
- Asignación con validación de técnico activo.
- Diagnósticos y presupuesto con control de técnico asignado.
- Un presupuesto pendiente por reparación y conservación de históricos.
- Decisiones presenciales y entregas idempotentes en la suite de Fase 4.
- Auditoría e historial para operaciones críticas.
- Tema claro/oscuro/sistema.
- Recarga de órdenes al recuperar foco y pull-to-refresh en el código actual.
- Bundle Android exportable.

### Parciales

- Renovación y revocación de sesión bajo concurrencia.
- Seguridad de producción HTTPS/TLS.
- Acciones permitidas después de estados terminales.
- Formularios y native modules en dispositivos reales.
- Documentación y OpenAPI sincronizados.

### Pendientes

- Probar registro/login/invitaciones de Fase 1 en una base de ensayo con permisos válidos.
- Ejecutar OAuth real con Google, GitHub y Discord.
- Instalar y probar una APK nueva en Android.
- Verificar cámara, QR, biometría, ubicación y sensores en hardware real.
- Resolver los hallazgos P0/P1 antes de la entrega final.

## 11. Plan recomendado de corrección

### P0 — Antes de continuar la entrega

1. Cerrar las mutaciones de diagnóstico, presupuesto y fotografía para órdenes entregadas/canceladas y reflejarlo en la UI.
2. Rehacer las transiciones de estado con lock y validaciones dentro de la misma transacción.
3. Centralizar la expiración de sesión del Frontend y limpiar tokens cuando falle el refresh.
4. Hacer que la configuración de producción falle si usa localhost o HTTP; exigir TLS de MariaDB cuando la conexión sea remota.

### P1 — Antes de declarar cumplimiento integral

1. Hacer atómica la rotación de refresh tokens y la reclamación del estado OAuth.
2. Repetir Fase 1 en una base de ensayo con permisos corregidos.
3. Capturar carreras de idempotencia de recepción y asignación de técnicos.
4. Incorporar tests de UI para guards, roles, estados terminales, refresh, formularios y errores.
5. Verificar OAuth real y generar/instalar una APK nueva en un dispositivo.
6. Revisar el almacenamiento y acceso autenticado de fotografías.
7. Actualizar dependencias vulnerables sin forzar downgrades incompatibles.

### P2 — Antes de la presentación final o como mejora inmediata

1. Corregir la etiqueta SDK 57 y los datos fijos de ubicación.
2. Sincronizar README, matriz, pruebas y OpenAPI.
3. Definir el tratamiento de la preferencia biométrica después del logout.
4. Documentar o deprecar roles/módulos heredados.
5. Añadir paginación y límites de listado.

## 12. Limitaciones y acciones manuales pendientes

La auditoría no incluyó:

- Instalación real de APK mediante ADB o prueba visual completa en un teléfono.
- Login OAuth real con los tres proveedores.
- Prueba de cámara, QR, biometría, GPS y sensores en hardware.
- Prueba de conectividad desde una red externa con HTTPS.
- Validación de la suite de Fase 1 porque el usuario de la base de ensayo no tenía permisos.
- Pruebas destructivas, migraciones o lecturas nuevas sobre la base original `techfix`.

Para cerrar esas evidencias, debe usarse una base de ensayo independiente, credenciales OAuth de desarrollo y una APK nueva configurada con una URL de API accesible desde el teléfono. La prueba manual no debe modificar la orden #2 ni crear datos en `techfix`.

## 13. Conclusión

TechFix tiene implementado un circuito presencial funcional y una arquitectura adecuada para continuar. La corrección P0 de cierre de órdenes entregadas quedó implementada y verificada en una base de ensayo; todavía no corresponde declarar el proyecto listo para entrega porque permanecen riesgos de sesión, configuración de producción, OAuth, APK/hardware y otras tareas P1/P2. El resultado conservador original de la auditoría fue 14 de 30 áreas obligatorias completamente comprobadas, 11 parciales y 5 pendientes; la corrección 5.1 se registra por separado y no reemplaza la verificación manual pendiente.

Las pruebas automatizadas de Backend, Frontend, Expo Doctor, export Android y las integraciones de Fases 2–4 son evidencia positiva. No obstante, la falta de verificación actual de OAuth/APK/hardware, la suite de Fase 1 bloqueada y los hallazgos F5-02 a F5-05 deben tratarse antes de presentar el proyecto como completo.

La verificación manual en Expo Go/Android continúa pendiente y no se declara completada.

## 14. Fase 5.1 — Corrección P0 de órdenes entregadas

### Causa exacta

La pantalla de detalle usaba `admin || técnico asignado` como condición suficiente para mostrar diagnóstico, presupuesto y fotografía. El Backend validaba rol y asignación, pero no verificaba el estado `entregado` en todos los repositorios de escritura. El registro de trabajo y la entrega tenían controles propios, pero usaban códigos distintos y no existía una política central común para todas las mutaciones.

### Endpoints auditados y resultado

| Endpoint | Comportamiento para `entregado` |
|---|---|
| `POST /api/repairs/:id/assign` | `409 REPAIR_CLOSED`; la comprobación ocurre dentro de la transacción con lock |
| `PATCH /api/repairs/:id/status` | `409 REPAIR_CLOSED`; no se crea historial nuevo |
| `POST /api/repairs/:id/diagnosis` | `409 REPAIR_CLOSED`; no se inserta diagnóstico |
| `POST /api/repairs/:id/work-logs` | `409 REPAIR_CLOSED`; no se inserta trabajo |
| `POST /api/repairs/:id/estimates` | `409 REPAIR_CLOSED`; no se crea presupuesto |
| `PATCH /api/repairs/:id/estimates/:estimateId/status` | `409 REPAIR_CLOSED`; no se modifica el presupuesto |
| `PATCH /api/repairs/:id/estimates/:estimateId/presential-decision` | `409 REPAIR_CLOSED`; no se registra decisión ni historial |
| `POST /api/repairs/:id/photos` | `409 REPAIR_CLOSED`; no se inserta fotografía |
| `POST /api/repairs/:id/delivery` | Segunda clave devuelve `409 DELIVERY_ALREADY_REGISTERED`; replay con la misma clave conserva la idempotencia y devuelve 200 sin crear otra entrega |
| `GET /api/repairs/:id` y `GET /api/repairs/:id/delivery` | Continúan disponibles según autorización de lectura |

No existe un endpoint separado para editar directamente los datos operativos de una reparación ni para modificar su historial. Los endpoints de equipos fueron auditados y no se ampliaron en esta fase porque corresponden al recurso equipo y no a una mutación operativa del circuito de reparación; cualquier cambio posterior debe definir una política específica para no alterar la trazabilidad histórica.

### Archivos modificados

- `Backend/src/utils/repair-lifecycle.ts`: nueva política central; `entregado` es el estado cerrado y genera `409 REPAIR_CLOSED`.
- `Backend/src/controllers/repair.controller.ts`: controles tempranos y llamadas actualizadas con el contexto de la reparación.
- `Backend/src/repositories/repair.repository.ts`: locks y validación de cierre para asignación, estado, diagnóstico, presupuesto, reemplazo, actualización de presupuesto y fotografías.
- `Backend/src/repositories/repair-lifecycle.repository.ts`: validación de cierre para decisiones, trabajos y entregas.
- `Backend/tests/repair-lifecycle.test.ts`: pruebas unitarias de la política.
- `Backend/tests/phase5.1.closed-repair.integration.test.ts`: prueba de lectura, bloqueos por rol, códigos 409, concurrencia y operación legítima en orden abierta.
- `Frontend/src/utils/repair-status.ts`: helper `isRepairClosed`.
- `Frontend/src/utils/repair-status.test.ts`: regresión de estado cerrado.
- `Frontend/src/utils/repair-actions.ts`: política reutilizable de visibilidad de acciones.
- `Frontend/src/utils/repair-actions.test.ts`: pruebas de visibilidad para órdenes abiertas y entregadas.
- `Frontend/app/(app)/repairs/[id].tsx`: mensaje de cierre y ocultamiento de asignación/acciones técnicas sin ocultar históricos.
- Este informe: registro de la Fase 5.1.

No se creó ni ejecutó una migración. No se modificaron `techfix`, la orden #2, usuarios, roles, contraseñas ni datos reales.

### Reglas de concurrencia

Las operaciones de escritura adquieren lock de la fila de `repair_requests` dentro de la misma transacción en la que verifican el estado y escriben. Si una entrega gana el lock, las operaciones posteriores observan `entregado` y fallan; si una operación técnica gana antes del cierre, queda registrada antes de la entrega, que es el orden real de los eventos. La entrega mantiene su idempotencia: la misma clave se considera replay sin duplicar, mientras que otra clave se rechaza.

### Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| Backend typecheck y build | **OK** |
| Backend unit tests | **OK**, 19 tests pasaron |
| Frontend typecheck y ESLint | **OK** |
| Frontend tests | **OK**, 23 tests pasaron |
| Fase 5.1 sobre `techfix_phase2_20261028` | **OK**, 4/4 tests pasaron |
| Fase 2 sobre base de ensayo | **OK**, 5/5 tests pasaron |
| Fase 3 sobre base de ensayo | **OK**, 3/3 tests pasaron |
| Fase 4 sobre base de ensayo | **OK**, 3/3 tests pasaron |

La suite creó y eliminó únicamente fixtures temporales en la base de ensayo indicada. No se ejecutaron estas pruebas sobre `techfix`.

### Riesgos pendientes

- La verificación manual de la pantalla cerrada en Expo Go todavía no fue realizada.
- Continúan pendientes los hallazgos F5-02 a F5-05 de la auditoría, especialmente la transición general bajo concurrencia, refresh de sesión, configuración HTTPS/TLS y OAuth.
- No se implementó reapertura automática ni procedimiento excepcional de reapertura. Cualquier reapertura futura debe ser una operación administrativa separada, explícita, auditada y autorizada.

### Verificación manual pendiente en Android

Con una orden de ensayo que ya esté en `entregado`, abrir el detalle con administrador y técnico asignado. Debe verse “Orden entregada y cerrada”, conservarse diagnóstico, presupuestos, trabajos, fotografías e historial, y no aparecer asignación, diagnóstico, presupuesto, trabajo ni adjuntar fotografía. La lista y el detalle deben seguir permitiendo lectura y la constancia de entrega debe permanecer visible.

La prueba debe hacerse con Expo Go apuntando al Backend de ensayo o con una APK de ensayo configurada de forma equivalente. No se debe probar modificando la orden #2 ni la base original.

### Actualización posterior a la verificación manual

La revisión de rutas confirmó que el detalle real utilizado por Expo Router es únicamente `Frontend/app/(app)/repairs/[id].tsx`; no existe otra pantalla de reparaciones que duplique el detalle en `app/`.

La causa reproducible en el Frontend era que el detalle cargaba la orden solo al montarse. Si la orden cambiaba a `entregado` mientras la pantalla seguía montada, conservaba el objeto anterior y podía seguir mostrando acciones. Además, las condiciones dependían de una coincidencia exacta del estado recibido. La pantalla ya tenía parte de la política de cierre, pero no garantizaba que el estado usado para renderizar fuera el actual.

La corrección incorporada en esta revisión:

- recarga el detalle mediante `useFocusEffect` al recuperar foco;
- evita que una respuesta anterior sobrescriba una respuesta más reciente;
- normaliza el estado antes de evaluar permisos de renderizado;
- utiliza `RepairOpenOnly` alrededor de asignación, estados, diagnóstico, trabajo, presupuesto y otras acciones operativas;
- conserva el técnico asignado, los históricos, fotografías, accesorios y constancia de entrega;
- agrega una prueba de renderizado que comprueba que las acciones prohibidas no aparecen para `entregado`.

La prueba de renderizado requiere `react-test-renderer` y sus tipos como dependencias de desarrollo. No modifica el bundle de producción.

Resultado actualizado: Frontend typecheck, ESLint y 31 tests pasaron; la prueba de pantalla completa pasó 4/4 para administrador, técnico, recepcionista y una orden abierta. El export Android volvió a pasar con 1448 módulos.

La verificación directa del bundle Metro activo fue HTTP 200 mediante `192.168.0.226:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&hot=false&minify=false`. El bundle contiene `Orden entregada y cerrada` y `repair-detail-state`, y corresponde al proyecto `Frontend`. Los textos de acciones también pueden existir en el bundle porque pertenecen a ramas de órdenes abiertas; la prueba de renderizado completa es la que confirma que no aparecen para `entregado`.

El log de desarrollo agregado es `[TechFixNav] repair-detail-state` y solo informa `repairId`, `status`, estado normalizado, `isClosed` y roles. No registra credenciales, tokens ni datos personales. La comprobación manual en el Motorola sigue pendiente; si el dispositivo continúa mostrando acciones, debe enviarse ese log y la URL/puerto que Expo Go muestra como servidor conectado.

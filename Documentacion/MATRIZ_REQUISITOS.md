# Matriz de requisitos

| Requisito | Implementación | Prueba | Resultado | Estado |
|---|---|---|---|---|
| Registro, login, logout y refresh | `Backend/src/services/auth.service.ts`, `Frontend/app/(auth)`, SecureStore | typecheck/tests; integración pendiente | Código compilable | Completo en código |
| Google, GitHub y Discord | `Backend/src/services/oauth.service.ts`, `Frontend/src/services/auth.ts` | Requiere credenciales y HTTPS | No ejecutado | Pendiente |
| Roles admin, recepcionista, técnico y cliente legado | `004_employee_identity.sql`, `techfix-permissions.ts`, `authorize`, controllers TechFix | unitarias y `phase1.integration.test.ts` en base restaurada | 4 roles y permisos verificados | Completo en Fase 1 |
| Invitaciones de empleados | `invitation.controller.ts`, `invitation.service.ts`, `invitation.repository.ts`, `employee_invitations` | token hash, uso único, vencimiento y permisos | 8/8 integración Fase 1 OK | Completo en Fase 1 |
| Clientes comerciales y recepción presencial | `005_presential_intake.sql`, `customer.controller.ts`, `intake.controller.ts`, pantallas `customers/` e `intakes/` | suite `phase2.integration.test.ts` contra `techfix_phase2_20261028` | 4/4 integración OK; datos temporales limpiados | Completo en base de ensayo |
| Seguridad del circuito presencial | políticas centralizadas, FKs, transacción e `Idempotency-Key` | pruebas de 403, asociación cliente-equipo y reintento | 4/4 integración OK; cero huérfanos | Completo en base de ensayo |
| Equipos | `devices` migration, repository, controller y rutas Expo | typecheck; MySQL pendiente | CRUD preparado | Completo en código |
| Reparaciones y estados | `repair_requests`, `repair-status.ts`, `repairs` screens | 4 tests de transición | 4/4 OK | Completo en código |
| Diagnósticos y presupuestos | repositories/controllers/servicios TechFix | typecheck; MySQL pendiente | Endpoints preparados | Completo en código |
| Fotos con cámara | `repair-photo.tsx`, `repair_photos`, POST `/repairs/:id/photos` | export Android; hardware pendiente | Bundle exportado | Pendiente de dispositivo |
| Notificaciones, estadísticas y auditoría | `misc.controller.ts`, servicios existentes | typecheck; MySQL pendiente | Código preparado | Completo en código |
| Context API y persistencia | `auth-context.tsx`, `theme-context.tsx`, SecureStore | typecheck | Implementado | Completo en código |
| Tema claro/oscuro/sistema | `src/theme`, Settings | typecheck | Implementado | Completo en código |
| QR, biometría y sensores | `app/native`, permisos Expo | Expo Doctor/export; hardware pendiente | Bundle exportado | Pendiente de dispositivo |
| API documentada | `openapi.ts`, `Documentacion/API.md` | revisión estática | Documentada | Completo en código |
| MySQL normalizada | migraciones 001–005, FKs, índices y transacciones | `techfix_phase2_20261028` | 27 tablas, 38 FKs, 001–005 y conteos históricos conservados | Completo en base de ensayo |
| Tests automatizados | `Backend/tests`, `Frontend/src/utils`, integración Fase 1 y Fase 2 | npm test e integración con base de ensayo | Backend: 16 unitarias + 4 integración Fase 2 OK; Frontend: 6 tests OK | Completo en base de ensayo |
| APK instalable | `Frontend/eas.json`, `app.json`, prebuild Android | `gradlew.bat assembleRelease`, `apksigner verify`; instalación aún pendiente | APK SDK 58 release generada y firmada; no instalada por falta de dispositivo ADB | Pendiente de dispositivo |

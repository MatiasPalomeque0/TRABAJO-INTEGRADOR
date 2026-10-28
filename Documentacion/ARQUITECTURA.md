# Arquitectura de TechFix

TechFix usa una arquitectura cliente-servidor. La APK nunca accede directamente a MySQL.

```text
APK Expo / React Native
  ├─ Expo Router: navegación y protección de sesión
  ├─ Context API + useReducer: autenticación y tema
  ├─ Services: HTTP, refresh JWT y módulos TechFix
  └─ Camera, QR, Location, biometría y sensores
              │ HTTPS + JSON
              ▼
API Express / TypeScript
  ├─ Middlewares: Helmet, CORS, rate limit, autenticación y roles
  ├─ Controllers: HTTP y códigos de respuesta
  ├─ Validators: Zod y limpieza de entradas
  ├─ Repositories: SQL parametrizado con mysql2
  └─ MySQL 8: datos normalizados, historial y auditoría
```

## Módulos de negocio

- `devices`: equipos del cliente y control de pertenencia.
- `repairs`: solicitudes, asignaciones, estados, diagnósticos, presupuestos y fotografías.
- `users`: perfiles, roles, estado de cuentas y protección del último administrador.
- `employee_invitations`: autorización administrativa de empleados, con tokens almacenados como hash y uso único.
- `customers`: clientes comerciales presenciales sin cuenta, con búsqueda y estado activo.
- `presential_intake`: recepción física de equipo, accesorios, condición de ingreso e idempotencia.
- `auth`: contraseñas con bcrypt, JWT corto, refresh rotativo/revocable y OAuth server-side.
- `misc`: notificaciones, estadísticas y auditoría.

## Roles

`cliente` legado crea equipos y solicitudes propias, consulta su historial y decide sobre presupuestos. `tecnico` opera reparaciones asignadas, registra diagnósticos, presupuestos y evidencias, sin acceso a clientes comerciales ni recepción. `recepcionista` registra clientes, equipos comerciales, ingresos y accesorios, y consulta las órdenes necesarias para atención; no realiza operaciones técnicas. `admin` supervisa el negocio, usuarios, servicios, clientes, asignaciones, estadísticas y auditoría.

La autorización se verifica en cada endpoint y no depende del rol enviado por la aplicación. El middleware vuelve a cargar el usuario para que una cuenta deshabilitada pierda acceso aun con un access token vigente. La política central distingue `admin`, `recepcionista`, `tecnico` y `cliente`; el circuito presencial tiene endpoints propios y valida en servidor cliente, equipo y responsable autenticado.

## Decisiones técnicas

- Expo SDK 58, React Native 0.88 y React 19.3 están instalados y validados por Expo Doctor 20/20. La Nueva Arquitectura se conserva habilitada por ser obligatoria en React Native 0.88.
- En SDK 58, los usos existentes de `readAsStringAsync` importan explícitamente `expo-file-system/legacy` para mantener la API heredada sin cambiar el comportamiento funcional.
- El access token es corto y contiene solo el identificador del usuario; el refresh token se almacena como hash, rota y puede revocarse.
- Los client secrets OAuth permanecen en el backend. El flujo usa `state`, PKCE, callback HTTPS del proveedor y handoff de un solo uso hacia `techfix://oauth/callback`.
- Las operaciones críticas usan transacciones; las consultas usan parámetros, índices y claves foráneas.
- La cámara guarda fotografías asociadas a la reparación. El QR solo identifica el recurso y el backend vuelve a comprobar permisos.

## Estructura

El backend está separado en `config`, `controllers`, `routes`, `services`, `repositories`, `middlewares`, `validators`, `utils` y `types`. El frontend separa rutas Expo, componentes, contextos, servicios, tipos, tema, hooks y utilidades.

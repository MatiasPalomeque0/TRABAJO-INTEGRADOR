# TechFix — Sistema de Gestión de Servicio Técnico

Trabajo Integrador de React Native para administrar equipos, solicitudes de reparación, diagnósticos, presupuestos, evidencias e historial de un servicio técnico informático.

## Organización

- `Frontend/`: Expo SDK 58, React Native 0.88, React 19.3, TypeScript, Expo Router, Context API, React Hook Form, Zod y SecureStore.
- `Backend/`: Node.js, Express, TypeScript, JWT, OAuth server-side, validaciones Zod y mysql2.
- `Documentacion/`: arquitectura, instalación, API, base de datos, manual, pruebas y matriz de requisitos.

## Estado de esta fase

El dominio TechFix está implementado en código: equipos, clientes comerciales, recepción presencial, accesorios, reparaciones, estados con transiciones por rol, diagnósticos, presupuestos, servicios, historial, notificaciones, auditoría y fotografías de reparación. El registro, login, refresh/logout, roles, tema, cámara, QR, biometría y sensores existentes se mantienen integrados. La migración 005 fue verificada en ensayo y activada controladamente en la base original `techfix`.

Verificado localmente: typecheck y build del backend, 16 tests backend unitarios, 4 tests de integración Fase 2 contra la base de ensayo, typecheck, lint y 6 tests del frontend, Expo Doctor 20/20, exportación del bundle Android, inicio con Expo Go SDK 58 y compilación nativa release SDK 58. OAuth real, instalación en un dispositivo y los flujos móviles contra una API real siguen pendientes de ejecutar con infraestructura, credenciales y dispositivo reales; no se declaran probados.

## Inicio rápido

```powershell
cd Backend
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

En otra terminal:

```powershell
cd Frontend
Copy-Item .env.example .env
# Editar EXPO_PUBLIC_API_URL con una URL accesible desde Android
npm install
npx expo start --lan
```

La APK no debe usar `localhost` como URL definitiva. Para pruebas físicas se necesita una API pública HTTPS o una IP accesible en la red local.

## Verificaciones

```powershell
cd Backend; npm run typecheck; npm test; npm run build
cd ..\Frontend; npm run typecheck; npm run lint; npm test; npx expo-doctor; npx expo export --platform android
```

## APK con EAS

```powershell
cd Frontend
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

El perfil `preview` está configurado para generar un APK instalable. La compilación requiere una cuenta EAS y una URL de API alcanzable.

## APK local verificada

La compilación nativa local SDK 58 se ejecutó correctamente con Expo prebuild y Gradle. En Windows fue necesario usar una copia temporal en una ruta corta para evitar el límite de rutas de CMake/Ninja; el APK resultante fue copiado al proyecto:

```powershell
cd Frontend
npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

El archivo entregado queda en `Frontend/android/app/build/outputs/apk/release/TechFix-SDK58-release.apk`. La firma fue verificada con `apksigner`; para instalarlo se necesita un dispositivo o emulador visible para ADB. En este entorno no había dispositivos conectados, por lo que la instalación y la validación contra MySQL/OAuth todavía no fueron ejecutadas.

## Documentación

Comenzar por `Documentacion/INSTALACION.md`, `Documentacion/API.md` y `Documentacion/MATRIZ_REQUISITOS.md`.

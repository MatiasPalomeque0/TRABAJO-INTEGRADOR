# Instalación y configuración

## Requisitos

- Node.js 22.13 o superior; el entorno actual usa Node 24.14.1.
- npm 11 o superior.
- Expo Go para SDK 58 si se desea probar el bundle durante el desarrollo.
- MySQL 8.
- Android Studio/JDK 17 para build local o cuenta EAS para build remoto.
- Un backend público HTTPS para OAuth y para la APK final.

## MySQL

Crear la base y un usuario de aplicación:

```sql
CREATE DATABASE techfix CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'techfix_app'@'%' IDENTIFIED BY 'cambiar-esta-clave';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON techfix.* TO 'techfix_app'@'%';
FLUSH PRIVILEGES;
```

En `Backend`, copiar `.env.example` a `.env` y completar host, usuario, contraseña, secreto JWT y TLS si MySQL es remoto:

```powershell
cd Backend
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

El migrador crea `schema_migrations`, registra el nombre y checksum SHA-256 de cada archivo y no vuelve a ejecutar una versión ya aplicada. Si el usuario de conexión no tiene permiso `CREATE`, creá la base previamente con el SQL anterior; el runner no elimina ni recrea tablas existentes.

### Rotación segura de la credencial de MariaDB

`techfix_app` es únicamente el usuario técnico de conexión entre el Backend y MariaDB. No es un usuario de inicio de sesión de TechFix y la rotación de su contraseña no modifica usuarios, roles, clientes ni reparaciones.

La rotación debe realizarse manualmente, usando un canal seguro y sin escribir la contraseña en scripts, logs o Git:

```sql
ALTER USER 'techfix_app'@'%' IDENTIFIED BY '<NUEVA_CLAVE_GENERADA_LOCALMENTE>';
FLUSH PRIVILEGES;
```

Después, actualizar solamente el archivo local `Backend/.env`, reiniciar el Backend y verificar una consulta de salud o una operación de lectura. No se debe modificar `Backend/.env.example` con una contraseña real. Si la conexión falla, detener el Backend, corregir el `.env` local y volver a probar; no cambiar el esquema ni los datos como parte de la rotación.

Swagger queda en `http://localhost:4000/docs`.

## Frontend

```powershell
cd Frontend
Copy-Item .env.example .env
# EXPO_PUBLIC_API_URL debe apuntar a la API, no a MySQL
npm install
npx expo start --lan --clear
```

Expo Go del teléfono debe ser compatible con SDK 58. La configuración `preview` actual de `Frontend/eas.json` apunta a una API HTTP de la red local y solo funciona mientras el teléfono y la computadora estén en la misma red. Para publicar o probar fuera de esa red se debe reemplazar por una API pública HTTPS. Nunca incluir secretos OAuth ni una conexión MySQL en la APK.

Las contraseñas usadas en los tests son fixtures ficticias de ejecución automatizada. No deben reutilizarse como credenciales de MariaDB, OAuth o usuarios reales.

## OAuth

Crear una aplicación en Google, GitHub y Discord y completar en el backend los tres pares de client ID/secret. Cada proveedor debe apuntar al callback HTTPS del backend, por ejemplo:

- `/api/auth/oauth/google/callback`
- `/api/auth/oauth/github/callback`
- `/api/auth/oauth/discord/callback`

El callback móvil configurado es `techfix://oauth/callback`. La integración queda pendiente de prueba hasta contar con credenciales y un dominio HTTPS reales.

## Publicación segura en GitHub

Antes de publicar:

1. Mantener `Backend/.env` y `Frontend/.env` fuera de Git; solo se publica cada `.env.example` con placeholders.
2. Revisar los archivos que se incorporarían con `git add` y no incluir respaldos, dumps, certificados, claves privadas ni artefactos de build.
3. Ejecutar un escaneo de secretos sobre el árbol actual y sobre todos los commits que se vayan a publicar.
4. Como el repositorio remoto todavía no tiene commits, la opción más segura es publicar una rama/historial limpio con un primer commit generado a partir del árbol ya sanitizado, conservando la rama histórica local fuera del repositorio público.
5. Si se necesita conservar el historial, usar una herramienta de reescritura como `git filter-repo` sobre una copia del repositorio, verificar el resultado y recién después publicar. No hacer `push --force` sin revisar el resultado.

La contraseña de MariaDB expuesta anteriormente debe considerarse comprometida y rotarse antes de publicar, aunque el repositorio remoto todavía esté vacío.

## APK

### Compilación local

La APK release SDK 58 se puede generar localmente después de instalar las dependencias del Frontend:

```powershell
cd Frontend
npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

El resultado queda en `Frontend/android/app/build/outputs/apk/release/app-release.apk`. La compilación SDK 58 fue verificada en este entorno y se entregó como `TechFix-SDK58-release.apk`. En Windows, si CMake informa que una ruta supera el límite de longitud, se recomienda usar EAS; también puede utilizarse una copia temporal del proyecto en una ruta corta. No se debe borrar `android` del proyecto original sin conservar un respaldo.

```powershell
cd Frontend
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

El perfil `preview` usa `android.buildType: apk`. Instalar el resultado con `adb install archivo.apk` y verificar login, refresh, CRUD, roles, tema y permisos nativos contra una API real. La instalación física, MySQL remoto y credenciales OAuth siguen pendientes hasta disponer de un dispositivo, infraestructura y cuentas de proveedores.

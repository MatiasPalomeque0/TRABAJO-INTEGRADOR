# TechFix — Respaldos de Fase 0

Fecha: 28/10/2026

## Ubicación

Los respaldos quedaron fuera del repositorio para evitar incorporarlos accidentalmente a Git:

`<RUTA_LOCAL_DE_RESPALDOS_FASE0>`

Archivos principales:

- `ProyectoIntegrador-codigo.zip`: copia del código y configuración no secreta.
- `ProyectoIntegrador-codigo/`: copia expandida del mismo respaldo.
- `techfix-full.sql.dpapi-aes256.json`: dump cifrado de la base `techfix`.
- `techfix-full.sql.key.dpapi`: clave del dump protegida con DPAPI para el usuario de Windows que ejecutó el respaldo.
- `techfix-inventory.tsv`: inventario de tablas y conteos.
- `schema_migrations.tsv`: versiones, archivos, checksums y fechas aplicadas.

No se incluyeron archivos `.env`. El respaldo de código tampoco incluye `node_modules`, `dist`, `.expo`, Gradle cache ni `Frontend/android/app/build`; esos elementos se regeneran con los lockfiles y las herramientas del proyecto.

## Integridad comprobada

| Elemento | Resultado |
|---|---|
| Copia de código | Robocopy finalizó con código 1, considerado correcto para archivos copiados. |
| Archivo ZIP | 3.128.883 bytes; SHA-256 `F068F4527BB2E0723B16A569BB7EB31E48D44075D3D9E1A8AE2A94CF9D6EDAD9`. |
| `.env` en copia expandida | 0 archivos. |
| `.env` en ZIP | 0 entradas. |
| Dump antes de cifrar | 31.052 bytes; contenía `CREATE TABLE`, `INSERT INTO` y `schema_migrations`. Fue eliminado después de verificarse el cifrado. |
| Dump cifrado | AES-256-CBC con HMAC-SHA256; 41.709 bytes. |
| Clave del dump | Protegida mediante DPAPI `CurrentUser`; no se imprimió ni se guardó una contraseña. |
| Verificación del dump cifrado | HMAC y SHA-256 del contenido descifrado correctos. |
| Base `techfix` | No se ejecutaron `CREATE`, `ALTER`, `UPDATE`, `DELETE` ni `DROP` sobre ella. |

## Inventario de la base original

Conexión usada, sin mostrar la contraseña: `localhost:3306`, base `techfix`, usuario `techfix_app`.

| Tabla | Registros |
|---|---:|
| `audit_events` | 6 |
| `devices` | 1 |
| `diagnoses` | 0 |
| `estimates` | 0 |
| `estimate_items` | 0 |
| `notifications` | 0 |
| `oauth_accounts` | 0 |
| `oauth_handoffs` | 0 |
| `oauth_states` | 0 |
| `projects` | 0 |
| `project_members` | 0 |
| `refresh_tokens` | 5 |
| `repair_photos` | 0 |
| `repair_requests` | 1 |
| `repair_status_history` | 1 |
| `roles` | 3 |
| `schema_migrations` | 3 |
| `services` | 3 |
| `task_comments` | 0 |
| `task_evidence` | 0 |
| `tasks` | 0 |
| `user_roles` | 2 |
| `users` | 2 |

El dump contiene las 23 tablas, datos de las 10 tablas no vacías y los tres registros aplicados de `schema_migrations`:

- `001_init.sql` — checksum `0b15991ac93e0f163081568fb63c00ee9255f01b44fa0916b29a63f2539eae85`.
- `002_evidence_data.sql` — checksum `206b9845d97aa5163dc01549ba9db40f3e5ab6f99ea9c1e1495dff002f4aa131`.
- `003_techfix_domain.sql` — checksum `44b37ebd9b668c8433255732e94ad7d97db44ec4b319255f692e01f7c812ae2a`.

## Restauración

### Copia de código

1. Extraer `ProyectoIntegrador-codigo.zip` en una carpeta nueva, nunca encima del proyecto activo.
2. Crear nuevamente `Backend/.env` y `Frontend/.env` desde los valores de un gestor seguro de secretos. No se guardaron en el respaldo.
3. Ejecutar `npm ci` en `Backend` y `Frontend` para reconstruir dependencias desde los lockfiles.

### Base de datos

El dump está protegido para el usuario de Windows que creó el respaldo. Para restaurarlo:

1. Usar el mismo usuario de Windows y descifrar el archivo `.dpapi-aes256.json` validando HMAC y el SHA-256 incluido en su metadata.
2. Crear una base de prueba nueva con un usuario administrativo de MariaDB, por ejemplo `techfix_restore_YYYYMMDD_HHMMSS`. Nunca usar `techfix` como destino de prueba.
3. Importar el SQL descifrado con el cliente XAMPP, solicitando la contraseña de forma interactiva:

```powershell
cmd.exe /d /s /c "\"C:\xampp\mysql\bin\mysql.exe\" --host=localhost --port=3306 --user=techfix_app --password --database=techfix_restore_YYYYMMDD_HHMMSS < \"techfix-full.sql\""
```

4. Comprobar `SHOW TABLES`, los conteos de `techfix-inventory.tsv`, las 23 tablas, las claves foráneas y los 3 registros de `schema_migrations`.
5. Eliminar el SQL temporal descifrado después de una restauración exitosa o mantenerlo únicamente en almacenamiento cifrado.

La clave DPAPI no es portable automáticamente a otro usuario o equipo. Si se necesita un respaldo portable, debe volver a cifrarse con un mecanismo institucional aprobado y una clave entregada por un canal separado; no debe escribirse la clave en este repositorio ni en un script.

## Restauración de prueba ejecutada

La primera tentativa se detuvo porque el usuario de aplicación no podía crear una base independiente. Luego se creó manualmente la base vacía `techfix_restore_20261028` y se repitió la verificación sin utilizar otro usuario.

Se comprobó que `techfix_app` tiene permisos sobre esa base, sin exponer contraseñas ni hashes en este documento. Antes de importar se descifró el respaldo siguiendo el procedimiento documentado y se validó su HMAC y SHA-256.

El dump no contiene `USE`, `CREATE DATABASE`, `DROP DATABASE` ni `ALTER DATABASE`. Contiene instrucciones `DROP TABLE` para las 23 tablas, pero la importación se ejecutó explícitamente contra la base de prueba vacía `techfix_restore_20261028`, nunca contra `techfix`. La restauración se realizó directamente desde memoria, sin crear un archivo SQL plano temporal.

Resultado de la restauración: exitosa, con código de salida 0 y sin errores de MariaDB.

| Comprobación | Resultado |
|---|---:|
| Tablas originales y restauradas | 23 / 23 |
| Tablas no vacías originales y restauradas | 10 / 10 |
| Claves foráneas originales y restauradas | 29 / 29 |
| Definiciones de claves foráneas | Coinciden |
| Tipos de restricciones | Coinciden: 1 `CHECK`, 29 `FOREIGN KEY`, 23 `PRIMARY KEY`, 8 `UNIQUE` |
| Tablas InnoDB originales y restauradas | 23 / 23 |
| Filas huérfanas en la restauración | 0 |
| Migraciones aplicadas | 3 / 3 |
| Versiones, nombres y checksums de migraciones | Coinciden |

La base original `techfix` se utilizó únicamente para lecturas de inventario y comparación. Sus conteos permanecieron iguales al respaldo y no se ejecutaron escrituras sobre ella.

## Limitaciones y estado de preparación

- El código está respaldado sin secretos ni dependencias regenerables.
- La base está respaldada en forma cifrada y el contenido se validó antes de eliminar el SQL plano.
- El inventario y `schema_migrations` están guardados.
- La restauración de prueba fue aprobada: el respaldo es recuperable en la base independiente `techfix_restore_20261028`.
- El respaldo cifrado utiliza una clave protegida con DPAPI de Windows; su recuperación requiere el mismo usuario de Windows que la protegió, salvo que se genere posteriormente un respaldo portable mediante un mecanismo aprobado.
- No se modificaron roles, esquemas, cuentas, datos, migraciones ni funcionalidades de TechFix.
- La Fase 0 queda preparada para iniciar la Fase 1. Esta verificación no autoriza por sí misma a ejecutar migraciones ni cambios sobre la base original.

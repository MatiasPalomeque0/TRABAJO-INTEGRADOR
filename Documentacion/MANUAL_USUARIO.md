# Manual de usuario de TechFix

## Acceso

1. Instalar la APK y abrir TechFix.
2. Registrarse con nombre, apellido, correo y contraseña segura. La cuenta se crea como Cliente.
3. También se puede ingresar con Google, GitHub o Discord cuando el backend tenga el proveedor configurado.
4. La sesión se conserva de forma segura y puede protegerse con biometría local.

## Cliente

1. Abrir `Equipos` y registrar marca, modelo, tipo y número de serie.
2. Elegir `Solicitar reparación`, indicar el equipo y describir el problema.
3. Abrir la reparación para consultar técnico, diagnóstico, historial y estado.
4. Cuando exista un presupuesto, aceptarlo o rechazarlo desde el detalle.
5. Consultar reparaciones anteriores y notificaciones desde el menú correspondiente.

## Técnico

1. Abrir las reparaciones asignadas.
2. Registrar el diagnóstico y la recomendación.
3. Crear el presupuesto para revisión del cliente.
4. Cambiar el estado respetando el flujo de trabajo.
5. Adjuntar una fotografía del equipo desde el detalle de la reparación.

## Administrador

Puede administrar usuarios, habilitación, roles, servicios, asignaciones, estados, estadísticas y auditoría. El sistema impide quitar o deshabilitar al último administrador activo.

## Tema, QR y sensores

En `Configuración` se puede elegir tema claro, oscuro o sistema, consultar estadísticas, abrir la demostración de acelerómetro/giroscopio y usar el lector QR. El QR solo identifica una reparación; el servidor sigue validando la sesión y los permisos.

## Cierre de sesión y permisos

Desde `Perfil` se puede cerrar sesión. La aplicación solicita cámara, ubicación o biometría únicamente al utilizar esas capacidades. Rechazar un permiso muestra un mensaje y no bloquea el resto de TechFix.

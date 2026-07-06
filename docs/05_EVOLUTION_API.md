# 05 Evolution API

## Rol en la plataforma

Evolution API es la integración externa encargada de gestionar instancias de WhatsApp, conexión de sesión, desconexión, consulta de estado y envío de mensajes de prueba o notificaciones.

## Regla de arquitectura

- El frontend y el APK no deben llamar directamente a Evolution API.
- La API Key de Evolution no debe exponerse en cliente.
- La integración se encapsula en n8n.

## Operaciones observadas en workflows

- Listar instancias.
- Crear instancia.
- Conectar instancia.
- Cerrar sesión de instancia.
- Enviar mensaje de texto.
- Recibir callback de estado.

## Workflows relacionados

- Private Balance - 02 WhatsApp Management.
- Private Balance - 03 WhatsApp Status.
- Private Balance - Nuevo Ingreso.

## Datos funcionales asociados

- instanceName.
- instanceId.
- phoneNumber.
- ownerJid.
- profileName.
- profilePhoto.
- connectedAt.
- lastSeenAt.
- status.

## Riesgos conocidos

- Si la resolución del canal es global o no contextual, Evolution puede recibir mensajes dirigidos a una instancia incorrecta.
- Parte de la configuración actual aún vive en workflows legacy y debe consolidarse con el modelo communication_channels.
- Las credenciales observadas en workflows deben migrarse o mantenerse exclusivamente como credenciales seguras de n8n.

## Recomendación documental

Tratar Evolution API como dependencia externa crítica. Todo cambio de endpoint, payload o credencial debe registrarse en CHANGELOG.md y DECISIONS.md.


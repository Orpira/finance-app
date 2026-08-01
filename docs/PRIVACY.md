# Privacidad

Este documento describe, de forma técnica y verificable, qué datos maneja Private Balance, dónde se guardan y qué sale del dispositivo. No es una política legal de privacidad; es documentación técnica para desarrollo, auditoría y para que la persona usuaria entienda el comportamiento real de la app.

## Filosofía de privacidad

Private Balance es local-first: el dominio financiero (ingresos, gastos, agenda, temporadas, reportes) vive en el dispositivo y no requiere backend propio para el uso diario. Las integraciones externas son opcionales, se activan explícitamente desde Configuración y nunca son la fuente de verdad de los datos financieros. No se afirma privacidad absoluta: una vez activada una integración, hay tránsito de datos fuera del dispositivo bajo control del usuario.

## Tipos de datos manejados

- **Datos financieros**: ingresos (servicios), gastos, ajustes, agenda/citas, temporadas, reportes y su estado (`pendiente`/`reportado`).
- **Configuración**: moneda, tema, modo de uso (Básico/Profesional), PIN (como hash con sal, nunca en texto plano).
- **Identidad de licencia**: código de dispositivo (`deviceCode`), tipo y estado de licencia.
- **Memoria conversacional de IA**: historial de conversación con el asistente, persistido localmente para poder retomarlo tras reiniciar la app.

## Dónde se almacenan

Todo lo anterior se guarda localmente en IndexedDB mediante Dexie (`src/database`), con un respaldo puntual de configuración en `localStorage` para recuperación rápida. No hay una base de datos remota propia que reciba estos datos para el uso diario.

## Qué datos pueden salir del dispositivo

| Integración | Cuándo se activa | Qué sale | Hacia dónde |
|---|---|---|---|
| Conversión de moneda (Frankfurter) | Siempre que se registra un ingreso en moneda distinta a la base | Códigos de moneda y fecha, sin datos financieros del usuario | `api.frankfurter.dev` (API pública) |
| Asistente conversacional con IA (proveedor OpenAI real) | Solo si el usuario tiene el proveedor configurado (`VITE_AI_PROVIDER=OPENAI`) y licencia activa | El mensaje del usuario y el contexto financiero estructurado necesario para responder | Proxy propio (`api/ai-provider-openai.ts`) → OpenAI |
| Automatización (n8n) | Solo si `N8N_AUTOMATION_WEBHOOK_URL` está configurada en el servidor; si no lo está, el evento se marca como entregado localmente y no se reintenta (ver [ADR-029](adr/ADR-029-Private-Balance-Core-Redesign.md)) | Eventos `income.created`, `expense.created`, `calendar.created` (outbox local) | Proxy propio en Vercel → n8n → Neon PostgreSQL |
| Canal WhatsApp (Evolution API) | Solo si el usuario conecta un canal de comunicación | Mensajes y estado del canal, resueltos por dispositivo/usuario | n8n → Evolution API |
| Backup en Google Drive | Solo si el usuario conecta Google Drive y activa el backup | Backup cifrado (AES-GCM) de las tablas financieras | `appDataFolder` de Google Drive del propio usuario |
| Activación de licencia | Al activar o renovar una licencia | Código de licencia firmado y código de dispositivo | Backend de licencias (`api/license-activate.ts`, Neon) |

Sin activar ninguna de estas integraciones, la app no envía datos financieros a ningún servicio externo.

## Integraciones externas

Ver también [docs/AUTOMATION_HUB.md](AUTOMATION_HUB.md) y [docs/05_EVOLUTION_API.md](05_EVOLUTION_API.md) para el contrato técnico completo de automatización y WhatsApp, y [docs/26_AI_FOUNDATION_PRIVACY_BOUNDARY.md](26_AI_FOUNDATION_PRIVACY_BOUNDARY.md) para el límite de privacidad diseñado en la capa de IA.

## Exportaciones

Las exportaciones de reportes (PDF, CSV, XLS) se generan y descargan localmente; no implican una subida automática a ningún servicio. El usuario decide qué hacer con el archivo exportado.

## Copias de seguridad

- **Backup local cifrado**: exportación/importación cifrada con una clave definida por el usuario; no sale del dispositivo salvo que el usuario lo comparta manualmente.
- **Backup a Google Drive**: usa exclusivamente el scope `drive.appdata` (carpeta privada de la aplicación, no accesible desde el Drive general del usuario ni desde otras apps) y cifra los datos con AES-GCM antes de subirlos. El JSON plano nunca sale sin cifrar por esta vía.

## Eliminación de información

- El restablecimiento por PIN olvidado borra toda la base local, incluida la licencia.
- No existe una copia remota del dominio financiero controlada por el propietario del proyecto: si el usuario borra los datos locales sin backup, la información no es recuperable desde ningún servidor propio.
- Los backups en Google Drive quedan bajo control del usuario en su propia cuenta; su eliminación depende de que el usuario los borre desde la app o directamente en Drive.

## Responsabilidades del usuario

- Mantener un backup cifrado actualizado si desea poder recuperar los datos ante pérdida o restablecimiento del dispositivo.
- Cuidar la clave de cifrado de los backups: sin ella, el backup cifrado no puede restaurarse.
- Decidir de forma consciente si activa automatización, WhatsApp, IA con proveedor real o backup en la nube, entendiendo que cada una implica salida de datos hacia un tercero.

## Limitaciones reales

- La app no puede garantizar privacidad si el dispositivo está comprometido (acceso físico, malware, extracción del APK).
- Las integraciones externas (n8n, Evolution API, OpenAI, Google Drive) están sujetas a sus propias políticas de privacidad y disponibilidad, fuera del control de este repositorio.
- No existe todavía cifrado extremo a extremo para una futura sincronización multidispositivo; esa funcionalidad está planificada, no implementada (ver [docs/00_SYSTEM_ARCHITECTURE_MASTER.md](00_SYSTEM_ARCHITECTURE_MASTER.md)).

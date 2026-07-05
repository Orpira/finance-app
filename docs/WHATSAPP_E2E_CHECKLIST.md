# Checklist E2E: Licencia y Canal WhatsApp

Fecha: 2026-07-05

Objetivo: validar que el flujo de licencia y el flujo de canal WhatsApp están desacoplados, que se prioriza código de vinculación sobre QR, y que las automatizaciones reutilizan el canal guardado en Neon.

## Precondiciones

- Entorno con build actual desplegado o ejecutado localmente.
- Variables de backend configuradas: `DATABASE_URL`, `N8N_WHATSAPP_WEBHOOK_URL`, `N8N_INTERNAL_TOKEN`.
- Workflow de WhatsApp Management publicado en n8n.
- Evolution API operativa y credencial válida en n8n.
- Dispositivo con identidad válida (`userCode`, `deviceCode`) y app iniciada.

## Datos de prueba sugeridos

- `userCode`: PB-USER-<uuid>
- `deviceCode`: PB-DEVICE-<uuid>
- `phoneNumber`: número real de WhatsApp con prefijo internacional (ejemplo: 34600111222)

## Caso 1: La licencia no crea instancia Evolution

Pasos:
1. Abrir Configuración -> Licencia.
2. Activar o reemplazar licencia V2 con código válido.
3. No abrir Canales de comunicación todavía.
4. Revisar ejecución en n8n:
   - workflow de provisioning (si aplica),
   - workflow de WhatsApp Management.
5. Revisar tabla `communication_channels` para `userCode` y `deviceCode`.

Resultado esperado:
- La activación de licencia finaliza correctamente.
- No se dispara creación de instancia Evolution por el flujo de licencia.
- No aparece un nuevo registro de WhatsApp en `communication_channels` únicamente por activar licencia.

Consulta SQL de verificación:
```sql
SELECT *
FROM communication_channels
WHERE user_code = '<userCode>'
  AND device_code = '<deviceCode>'
  AND provider = 'whatsapp';
```

## Caso 2: Conectar WhatsApp crea o reutiliza instancia

Pasos:
1. Abrir Configuración -> Canales de comunicación.
2. Verificar estado inicial: "No conectado".
3. Pulsar "Conectar WhatsApp" con número válido.
4. Revisar en n8n que el workflow:
   - busca canal existente,
   - crea instancia solo si no existe,
   - reutiliza si ya existe.
5. Repetir "Conectar WhatsApp" sin desconectar para validar reutilización.

Resultado esperado:
- Primera vez: crea o recupera instancia según corresponda.
- Reintento: no genera instancia duplicada.
- En Neon solo hay un canal por `(user_code, device_code, provider)`.

Consulta SQL de verificación:
```sql
SELECT user_code, device_code, provider, instance_name, instance_id, status, updated_at
FROM communication_channels
WHERE user_code = '<userCode>'
  AND device_code = '<deviceCode>'
  AND provider = 'whatsapp';
```

## Caso 3: Se muestra código de vinculación cuando está disponible

Pasos:
1. Iniciar conexión WhatsApp.
2. Observar respuesta del workflow y la UI.

Resultado esperado:
- Si Evolution entrega `pairingCode`, la UI muestra bloque "Código de vinculación".
- El texto guía indica ruta de WhatsApp para vincular por código.
- No se prioriza QR si existe `pairingCode`.

## Caso 4: QR solo aparece como fallback

Pasos:
1. Forzar condición en la que Evolution no devuelve `pairingCode` (o usar versión sin soporte).
2. Iniciar conexión WhatsApp.

Resultado esperado:
- La UI muestra QR solo cuando no hay `pairingCode`.
- El texto muestra que QR es método alternativo desde otro dispositivo.

## Caso 5: Canal conectado queda guardado en Neon

Pasos:
1. Completar vinculación hasta estado conectado.
2. Cerrar y reabrir app.
3. Volver a Canales de comunicación.
4. Ejecutar consulta SQL en Neon.

Resultado esperado:
- Estado mostrado: "Conectado".
- Se visualizan número conectado y última sincronización.
- No se vuelve a pedir QR/código al estar conectado.
- En Neon quedan poblados campos relevantes:
  - `instance_name`, `instance_id`, `phone_number`,
  - `owner_jid`, `profile_name`, `profile_photo`,
  - `status='connected'`, `connected_at`, `last_seen_at`, `updated_at`.

Consulta SQL de verificación:
```sql
SELECT user_code, device_code, provider, instance_name, instance_id,
       phone_number, owner_jid, profile_name, profile_photo,
       status, connected_at, last_seen_at, updated_at, provider_metadata
FROM communication_channels
WHERE user_code = '<userCode>'
  AND device_code = '<deviceCode>'
  AND provider = 'whatsapp';
```

## Caso 6: Nuevo ingreso usa canal guardado sin pedir autorización

Pasos:
1. Con canal en estado conectado, crear un nuevo ingreso en la app.
2. Revisar ejecución de workflow de automatización.
3. Verificar que el payload incluye `communicationChannel.instanceName` y `communicationChannel.phoneNumber`.
4. Repetir con canal desconectado o inexistente.

Resultado esperado:
- Con canal conectado: se intenta envío WhatsApp usando canal persistido.
- Sin canal conectado: el flujo financiero no falla y omite WhatsApp.
- No se solicita QR/código ni se crea instancia desde evento de ingreso.

## Matriz rápida de aceptación

- Licencia no crea instancia Evolution: OK/FAIL
- Conectar WhatsApp crea/reutiliza instancia: OK/FAIL
- Pairing code visible cuando existe: OK/FAIL
- QR solo fallback: OK/FAIL
- Canal persistido en Neon y reutilizado: OK/FAIL
- Ingreso usa canal guardado sin reautorización: OK/FAIL

## Evidencias recomendadas

- Captura de estado "No conectado".
- Captura de "Código de vinculación" o QR fallback.
- Captura de estado "Conectado" con número y última sincronización.
- Logs de ejecución n8n (WhatsApp Management + Nuevo Ingreso).
- Resultado SQL de `communication_channels` antes y después.

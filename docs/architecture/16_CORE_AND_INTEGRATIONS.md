# 16 Core and Integrations

Ver también [ADR-029](../adr/ADR-029-Private-Balance-Core-Redesign.md) (decisión), [AI_INTERACTION_ARCHITECTURE.md](AI_INTERACTION_ARCHITECTURE.md) (asistente) y [docs/PRIVACY.md](../PRIVACY.md) (qué datos salen del dispositivo).

## Principio

El núcleo de Private Balance (finanzas, agenda, reportes, seguridad, copias de seguridad, configuración y el asistente inteligente) debe arrancar y operar por completo sin WhatsApp, Evolution API ni n8n configurados. Esas tres integraciones son opcionales: se conservan en el repositorio, con sus tests, pero desactivadas por defecto y fuera de la experiencia principal.

```
Private Balance
│
├── Núcleo                          (src/pages, src/services, src/database)
│   ├── Finanzas (Ingresos/Egresos/Movimientos)
│   ├── Agenda
│   ├── Reportes
│   ├── Seguridad (PIN, cifrado, backups)
│   └── Asistente inteligente        (src/intelligence, src/pages/Conversation)
│
├── Servicios de plataforma
│   ├── Persistencia (Dexie/IndexedDB)
│   ├── Automatización / outbox      (src/services/automationOutboxService.ts)
│   └── Exportaciones (PDF/CSV/XLS)
│
└── Integraciones opcionales (server/, api/)
    ├── WhatsApp
    │   ├── Evolution (server/automation/providers/whatsapp/EvolutionWhatsAppProvider.ts)
    │   └── Meta Cloud (server/communication/**, api/communication/**)
    └── n8n (server/automation/webhookDispatcher.ts, server/automation/eventDispatcher.ts)
```

El núcleo no importa directamente implementaciones de Evolution, Meta Cloud o n8n: solo llega a ellas a través de `dispatchAutomationEvent` / `WhatsAppProviderFactory`, ambos server-side. El frontend nunca contacta n8n, Evolution o Meta directamente — todo pasa por `/api/automation*` y `/api/communication*` en este mismo backend (ver `src/services/automationHubService.ts`, `src/services/communicationChannelService.ts`).

## Cómo queda desactivado cada componente

### n8n (eventos financieros y de agenda)

`server/automation/webhookDispatcher.ts` trata la ausencia de `N8N_AUTOMATION_WEBHOOK_URL` / `N8N_DEVICE_PROVISIONING_WEBHOOK_URL` como automatización desactivada para los eventos `income.created`, `expense.created`, `calendar.created` y `service.completed`: el despacho retorna éxito sin hacer ninguna llamada de red, y el evento no vuelve a reintentarse. Antes de este cambio, la ausencia del webhook producía un error 503 que quedaba reintentando indefinidamente en `automationOutbox` (backoff hasta 24h, sin límite de intentos) — ver ADR-029.

Los eventos de canal WhatsApp (`device.whatsapp.connect.requested`, `communication.whatsapp.*`) **no** entran en esta degradación: si `N8N_WHATSAPP_WEBHOOK_URL` falta, siguen fallando de forma explícita, porque su UI (Configuración → Canales de comunicación) depende de una respuesta real (por ejemplo, el QR de conexión) y fingir éxito sería engañoso para quien intenta conectar WhatsApp deliberadamente.

### Evolution API

Nunca se llama directamente desde este repositorio: `EvolutionWhatsAppProvider` siempre reenvía al webhook de WhatsApp de n8n. Con n8n sin configurar (estado por defecto recomendado para el núcleo), Evolution simplemente no se ejecuta — no hay ningún proceso que la invoque de forma automática ni al arrancar la app.

### Meta Cloud (WhatsApp Cloud API)

Controlado por `WHATSAPP_CLOUD_ENABLED` / `WHATSAPP_CLOUD_ALLOW_REAL_SEND` / `WHATSAPP_CLOUD_WEBHOOK_ENABLED` en `server/communication/config/metaCloudConfig.ts`, los tres `false` por defecto (fail-closed): si `WHATSAPP_CLOUD_ENABLED` es `false` o no está definida, el backend arranca sin exigir ninguna variable `META_*`. `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N` / `WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N` (también `false` por defecto) controlan si Meta Cloud reenvía eventos a n8n.

### Navegación y UI

WhatsApp solo es visible dentro de Configuración → Canales de comunicación; nunca en la navegación principal (Inicio / Movimientos / Agenda / Asistente / Más). Evolution y n8n son nombres internos que nunca se exponen al usuario final.

## Cómo reactivar cada integración

1. **n8n**: definir `N8N_AUTOMATION_WEBHOOK_URL`, `N8N_INTERNAL_TOKEN` (y el resto de `N8N_*` relevantes) en el entorno del servidor (Vercel). No requiere cambios de código.
2. **Evolution**: definir `WHATSAPP_PROVIDER=evolution` (o dejarlo sin definir, es el valor por defecto de compatibilidad) junto con `N8N_WHATSAPP_WEBHOOK_URL` y `N8N_INTERNAL_TOKEN`, y conectar el canal desde Configuración → Canales de comunicación.
3. **Meta Cloud**: `WHATSAPP_PROVIDER=meta-cloud`, `WHATSAPP_CLOUD_ENABLED=true` y las variables `META_*` requeridas (ver `docs/whatsapp/meta-cloud-environment.md`).
4. **n8n como motor de automatización general**: los workflows de plantilla siguen en `n8n/workflows/whatsapp-cloud/*.staging.json`, sin cambios.

Ninguna reactivación requiere tocar el código del núcleo: son variables de entorno y configuración de usuario.

## Variables `VITE_` prohibidas en el cliente

`vite.config.ts` falla el build si detecta `VITE_N8N_*`, `VITE_META_*`, `VITE_EVOLUTION_API_KEY` o `VITE_PRIVATE_BALANCE_TOKEN` con un valor no vacío. Este mecanismo se mantiene sin cambios y es la defensa principal contra fuga de secretos de automatización hacia el bundle cliente.

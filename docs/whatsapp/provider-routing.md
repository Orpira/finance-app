# Enrutamiento de proveedor: Evolution vs. meta-cloud

> Fase 4. Documenta la decisión de dónde se resuelve "qué proveedor de
> WhatsApp está activo" y por qué nunca hay dos proveedores efectivos a la
> vez para el mismo evento.

## Dónde se decide

**En el backend, antes de llamar a n8n** — no mediante un nodo de
enrutamiento en n8n ni con workflows separados por proveedor. Es la opción
que minimiza riesgo y duplicación:

```ts
// server/automation/eventDispatcher.ts
const webhook = isWhatsAppChannelEvent(input.envelope.event)
  ? await resolveActiveWhatsAppProvider().dispatchChannelEvent({ ... })
  : await dispatchWebhook({ ... })
```

`resolveActiveWhatsAppProvider()` lee `WHATSAPP_PROVIDER` (Fase 2) y
construye exactamente un proveedor: `EvolutionWhatsAppProvider` o
`MetaCloudWhatsAppProvider`. Nunca ambos, nunca ninguno con fallback
silencioso al otro (ver `docs/whatsapp/provider-abstraction.md`).

## Por qué no en n8n

Alternativas descartadas y motivo:

1. **Nodo de enrutamiento en n8n** — duplicaría la decisión en dos sitios
   (backend y n8n), con riesgo de que queden desincronizados (p. ej.
   backend en meta-cloud pero el nodo de n8n todavía apuntando a Evolution).
2. **Workflows completamente separados por proveedor, activados
   manualmente** — multiplica el mantenimiento (dos workflows a mantener en
   paralelo) sin beneficio real, dado que el backend ya centraliza la
   decisión de forma atómica por request.

Resolverlo en el backend significa que **n8n nunca necesita saber** qué
proveedor está activo para los eventos financieros: siempre llama al mismo
webhook (`N8N_AUTOMATION_WEBHOOK_URL`), y es el backend quien decide, para
los 6 eventos específicos de canal WhatsApp, si esa llamada va hacia
Evolution (vía el mismo webhook de n8n de siempre) o hacia meta-cloud (vía
los endpoints nuevos `/api/communication/whatsapp/*`).

## Único proveedor efectivo por evento

Regla (sección 34 del documento de la Fase 4): un evento nunca se procesa
por Evolution y meta-cloud simultáneamente.

Cómo se garantiza:

1. `resolveActiveWhatsAppProvider()` construye un único proveedor por
   invocación — no hay ninguna ruta de código que invoque a los dos.
2. Cada proveedor aplica su propia idempotencia (Evolution vía el
   `dispatchWebhook` genérico + `processed_events` de n8n; meta-cloud vía
   `communication_idempotency_keys`, Fase 3) — no comparten claves ni
   pueden "pisarse".
3. Si meta-cloud falla, **no hay fallback automático a Evolution**. La
   solicitud falla explícitamente (error normalizado, ver
   `docs/whatsapp/meta-cloud-backend.md`) y el rollback es manual: cambiar
   `WHATSAPP_PROVIDER=evolution` en la configuración del entorno.
4. La coexistencia de datos (una fila de Evolution y otra de meta-cloud en
   `communication_channels`, ver
   [meta-channel-persistence.md](meta-channel-persistence.md)) es
   intencional para permitir ese rollback sin perder el estado de
   Evolution — pero solo uno de los dos backends recibe tráfico real en un
   momento dado, según `WHATSAPP_PROVIDER`.

## Selección de destinatario

El destinatario nunca se codifica dentro de un workflow de n8n. Proviene de:

- El evento ya validado (`payload.recipient` construido por el workflow a
  partir de datos ya resueltos por Private Balance), o
- El canal persistido (`communication_channels.phone_number`, Fase 4), o
- Para staging exclusivamente, `WHATSAPP_CLOUD_TEST_RECIPIENT` (variable de
  entorno, nunca en el repositorio, nunca en producción).

## Matriz de configuración

| `WHATSAPP_PROVIDER` | Eventos de canal WhatsApp van a | Evolution sigue activo | meta-cloud recibe tráfico |
|---|---|---|---|
| `evolution` (por defecto) | `EvolutionWhatsAppProvider` → n8n → Evolution | Sí | No |
| `meta-cloud` | `MetaCloudWhatsAppProvider` → backend de comunicaciones | Sí (datos conservados, sin tráfico) | Sí |

Cambiar de fila es un único cambio de variable de entorno, sin desplegar
código ni tocar workflows.

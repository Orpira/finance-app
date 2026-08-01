# ADR-029 - Private Balance Core Redesign

Estado: Accepted
Version: 1.0
Fecha: 2026-08-01
Relacionado: ADR-025, docs/whatsapp/*, docs/AUTOMATION_HUB.md

## Problema

Private Balance nació y creció fuertemente ligado a la integración de WhatsApp (Evolution API + n8n) como canal de automatización. La visión de producto evoluciona hacia una plataforma privada e inteligente de finanzas personales que debe funcionar completamente sin WhatsApp, Evolution API ni n8n, conservando esas integraciones como opcionales, aisladas y reactivables — nunca borradas.

## Contexto (auditoría previa a este ADR)

Antes de decidir cambios, se auditó el estado real del proyecto (ver `docs/architecture/16_CORE_AND_INTEGRATIONS.md`). Hallazgos relevantes:

- WhatsApp ya estaba aislado en la UI: solo visible en Configuración → Canales de comunicación, nunca en la navegación principal.
- Evolution API nunca es llamada directamente por el código propio; siempre reenvía a través del webhook de WhatsApp de n8n (`EvolutionWhatsAppProvider`).
- El asistente de IA (`/conversation`) ya era independiente de WhatsApp — vive en su propia arquitectura (`src/intelligence/`), documentada en ADR-010 a ADR-028.
- Los flags `WHATSAPP_CLOUD_ENABLED` / `WHATSAPP_CLOUD_ALLOW_REAL_SEND` / `WHATSAPP_CLOUD_WEBHOOK_ENABLED` ya existían y ya son `false` por defecto (fail-closed).
- El hueco real: los eventos financieros (`income.created`, `expense.created`, `calendar.created`, `service.completed`) no tenían forma de degradarse limpiamente sin n8n — si el webhook no estaba configurado, el evento quedaba reintentando indefinidamente en el outbox local (backoff hasta 24h, sin límite de intentos).
- La pantalla de Inicio tenía la tarjeta "Ingresos sin reportar" reducida a JSX muerto y comentado (commit `21dbe99`, referenciando una variable `reportedCard` que ya no existe), sin secciones de acciones rápidas, agenda próxima ni resumen inteligente.
- El asistente estaba enterrado dentro de "Más → Inteligencia", presentado como "Preview conversacional" / "AI Conversation".

## Decisión

1. **n8n deja de ser obligatorio para el dominio financiero**: `webhookDispatcher.ts` trata la ausencia del webhook configurado para los cuatro eventos financieros/agenda como automatización desactivada (éxito sin llamada externa), no como un error. Los eventos de canal WhatsApp y el aprovisionamiento de dispositivo conservan su comportamiento estricto sin cambios, porque su UI depende de una respuesta real.
2. **Navegación consolidada**: se reemplazan las pestañas separadas de Ingresos/Egresos por una sección "Movimientos" (pestañas Todos/Ingresos/Egresos, reutilizando `IncomeListPage`/`ExpenseListPage` sin duplicar su lógica de filtros) y el Asistente pasa de estar enterrado en "Más" a ser un ítem principal de navegación, en ambos modos de uso (Profesional y Básico).
3. **Inicio rediseñado** alrededor de: resumen financiero (ya existente), ingresos sin reportar (reconstruido sobre el servicio ya probado `getPendingIncomeSummary()`, no revirtiendo el commit que lo desactivó), acciones rápidas, agenda próxima, resumen inteligente basado en reglas deterministas (sin llamada a IA) y actividad reciente.
4. **El Asistente se presenta como función nativa de Private Balance**, no como un preview de WhatsApp: título "Asistente", sugerencias rápidas del catálogo de casos de uso del producto, y una nota visible de que ninguna acción se guarda sin confirmación explícita del usuario — enunciando el flujo propuesta → confirmación ya implementado en `src/intelligence/execution-pipeline`.
5. **Ninguna integración se elimina.** Todo el código de Meta Cloud, Evolution y n8n permanece intacto, con sus tests, y se documenta cómo reactivarlo.

## Consecuencias

- El núcleo (finanzas, agenda, reportes, seguridad, asistente) puede operar íntegramente sin variables `N8N_*`, `META_*`, `WHATSAPP_*` configuradas, sin errores visibles ni reintentos infinitos.
- Las integraciones opcionales siguen siendo código de primera clase, solo que inactivas por defecto y fuera de la experiencia principal.
- La deuda técnica pre-existente en `docs/context/TODO.md` (certificación de workflows n8n, convergencia legacy) no se resuelve aquí; sigue siendo responsabilidad de las fases R1-R4 de `docs/context/ROADMAP.md`.

## Explícitamente fuera de alcance de esta iteración

- Reescritura completa del pipeline de IA o de sus reglas de privacidad (ya documentadas en ADR-026 a ADR-028 y `26_AI_FOUNDATION_PRIVACY_BOUNDARY.md`).
- Vista "Todos" de Movimientos con los mismos filtros avanzados que Ingresos/Egresos (por ahora es una lista reciente con búsqueda simple; los filtros completos siguen viviendo en las pestañas Ingresos/Egresos).
- Cambios al sistema de licencias, modo Básico/Profesional o a las reglas de cálculo financiero.

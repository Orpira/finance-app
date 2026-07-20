# AI Context - Private Balance

Documento de contexto operativo para agentes IA y traspaso técnico sin pérdida de invariantes de negocio.

## 1) Misión técnica del sistema

Private Balance es una aplicación local-first para finanzas personales/profesionales con:

- núcleo financiero en Dexie/IndexedDB;
- automatización remota vía Vercel Functions + n8n;
- soporte de WhatsApp mediante Evolution API;
- backend de licencias/dispositivos/canales en Neon PostgreSQL.

## 2) Restricciones no negociables

- No alterar cálculos financieros sin autorización explícita.
- No modificar balances históricos.
- No exponer secretos en frontend/PWA/APK.
- No resolver canal WhatsApp por recencia global sin contexto.
- No saltar validaciones de licencia/dispositivo.
- No convertir arquitectura objetivo en "hecho" sin evidencia de implementación.

## 3) Fuentes de verdad por prioridad

1. `docs/PRIVATE_BALANCE_CONSTITUTION.md`
2. `docs/DECISIONS.md`
3. `docs/CHANGELOG.md`
4. `docs/AUTOMATION_HUB.md`
5. `docs/03_DATABASE.md` y `docs/04_N8N_WORKFLOWS.md`
6. Código TypeScript en `src/`, `api/`, `server/`

## 4) Mapa de arquitectura real (implementada)

- Cliente React/TypeScript: UI, reglas locales, persistencia Dexie, outbox.
- Vercel Functions (`api/*`): validación, JWT temporal, gateway de eventos.
- n8n: orquestación de workflows de provisión, comunicación y eventos.
- Neon: licencias, dispositivos y canales de comunicación.
- Evolution API: transporte WhatsApp encapsulado en n8n.

## 5) Estado AI Foundation

Implementado y verificable:

- Financial Engine Adapter (lectura determinista, fail-closed).
- Reports shadow mode (legacy continúa oficial).
- Home pilot controlado por `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- Snapshot shadow/promotion controlados por feature flags.
- Knowledge shadow/promotion controlados por feature flags.
- Pipeline Insights 7B -> 7F integrado en dashboard profesional.

No implementado globalmente:

- AI Core completo como fuente única de verdad.
- Runtime LLM con autoridad sobre datos financieros.

## 6) Invariantes críticos para cualquier intervención

- `services` y `expenses` son la base contable operativa.
- `financialSnapshots` y `knowledgeSnapshots` son derivados append-only.
- `reset/import/export` financiero no deben destruir snapshots.
- Automatización no forma parte de la transacción de persistencia local.
- Outbox debe preservar intentos y reintentos con idempotencia.

## 7) Límites de componentes

- UI no accede directamente a runtime interno de Insight.
- Servicios de aplicación no deben mezclar secretos de servidor.
- Workflows n8n no deben asumir autorización implícita del cliente.
- MCP/IA se usa para auditoría/desarrollo, no runtime productivo.

## 8) Definición operativa de cierre 8A en esta entrega

Para esta fase documental, 8A se considera técnicamente listo si:

- existe paquete de documentación architecture/context/handoff completo;
- la documentación está alineada con Constitución + ADRs + código real;
- no se modificó código de aplicación;
- no se ejecutaron acciones Git;
- el handoff deja trazabilidad suficiente para certificación.

## 9) Comandos de verificación usados para evidencia contextual

- `npm test`
- `npm run build`
- `npm run test:indexeddb`
- búsquedas estructurales con `rg` sobre docs/src/api/server/test

## 10) Riesgos de interpretación para futuros agentes

- No confundir roadmap de `09_AI_CORE_ARCHITECTURE.md` con implementación actual.
- No asumir que todas las ramas de workflows n8n responden igual de robusto.
- No asumir que existe definición formal de "8A" en código si no aparece explícita.

## 11) Regla de salida esperada en handoff

Toda entrega de esta fase debe cerrar con veredicto binario de certificación:

- `✅ 8A LISTO PARA CERTIFICACIÓN`
- `❌ 8A BLOQUEADO`

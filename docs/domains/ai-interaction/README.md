# Dominio AI Interaction

**Estado:** Active — Milestones 9A–9C

## Objetivo

Representar una solicitud inteligente como una unidad de dominio independiente de UI, conversación, persistencia y proveedor.

## Incluido en 9A–9C

Identidad, intención, capacidades, política, metadatos, resultado, fallo, validación estructural y lifecycle determinista de interacción.

## Lifecycle 9C

El dominio incorpora un lifecycle provider-neutral y fail-closed en `src/intelligence/ai-interaction/lifecycle`.

Estados del lifecycle:

- `CREATED`
- `VALIDATED`
- `AUTHORIZED`
- `CONTEXT_BUILT`
- `EXECUTING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

Estados finales inmutables:

- `COMPLETED`
- `FAILED`
- `CANCELLED`

Transiciones permitidas:

- `CREATED -> VALIDATED`
- `VALIDATED -> AUTHORIZED`
- `AUTHORIZED -> CONTEXT_BUILT`
- `CONTEXT_BUILT -> EXECUTING`
- `EXECUTING -> COMPLETED`
- `EXECUTING -> FAILED`
- `EXECUTING -> CANCELLED`

Cualquier transición fuera de este catálogo se rechaza explícitamente.

## Relación con Policy Engine 9B

El Policy Engine decide si la interacción puede avanzar desde el punto de vista de autorización (`ALLOW`, `DENY`, `REQUIRE_*`).

El Lifecycle 9C no evalúa reglas de autorización ni capacidades de proveedor; solo gobierna transiciones válidas de estado de forma determinista.

## Excluido

Red, prompts, selección efectiva de proveedor, persistencia, mensajes, memoria, tools, ejecución financiera y UI.

## API pública

`src/intelligence/ai-interaction/index.ts`.

## Dependencias permitidas

Tipos JSON-safe ya certificados y tipos de AI Foundation. El dominio no depende de React, Dexie, Capacitor ni SDKs externos.

# ADR-012 — AI Interaction Lifecycle

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-010, ADR-011, AI Foundation 8A–8F, Milestones 9A y 9B

## Problema

El dominio AI Interaction ya modela contratos y autorización por políticas, pero no tenía un mecanismo central para controlar el ciclo de vida completo de cada interacción.

Sin un lifecycle compartido, cada consumidor futuro (Conversation, Memory, Insight Engine, Tools) podía implementar transiciones distintas, con riesgo de inconsistencias y estados inválidos.

## Contexto

Private Balance requiere una evolución deterministic-first, provider-neutral y fail-closed. El ciclo de vida de interacción debe vivir en dominio puro, sin UI, sin persistencia, sin red y sin dependencias externas.

Las decisiones de políticas de 9B siguen siendo una puerta de autorización separada; el lifecycle de 9C define exclusivamente cómo una interacción avanza por estados válidos una vez creada.

## Decisión

Implementar un subdominio `lifecycle` en `src/intelligence/ai-interaction/lifecycle` con:

- catálogo cerrado de estados y eventos;
- transiciones explícitas y registradas;
- validación determinista fail-closed;
- estados finales inmutables (`COMPLETED`, `FAILED`, `CANCELLED`);
- servicio reusable para consultar, validar y aplicar transiciones.

Flujo principal aceptado:

`CREATED -> VALIDATED -> AUTHORIZED -> CONTEXT_BUILT -> EXECUTING -> COMPLETED`

Flujos alternativos aceptados:

- `EXECUTING -> FAILED`
- `EXECUTING -> CANCELLED`

Cualquier transición no registrada o no permitida se rechaza explícitamente.

## Consecuencias

- Se centraliza la gobernanza del estado de interacciones en un único punto de dominio.
- Los consumidores futuros reutilizan la misma semántica de lifecycle sin duplicar reglas.
- Se facilita trazabilidad y certificación al tener un contrato de transición explícito.
- Se preserva la independencia frente a proveedor, UI y persistencia.

## Alternativas descartadas

1. Lifecycle embebido en cada consumidor (Conversation/Memory): descartado por duplicación y deriva semántica.
2. Lifecycle implícito por side effects de servicios: descartado por baja auditabilidad y menor determinismo.
3. Máquina de estados dependiente de librería externa: descartado para mantener dependencia cero y control total del contrato.
# ADR-011 — AI Interaction Policies

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-010, AI Foundation 8A–8F, Milestone 9A

## Contexto

Private Balance necesita decidir si una interacción de IA puede avanzar antes de construir contexto o invocar un adaptador. La decisión no puede depender de un proveedor ni quedar dispersa en UI, servicios o prompts.

## Decisión

Toda interacción debe pasar por un motor determinista de políticas. El motor resuelve una política por identificador y versión, valida el contrato 9A y devuelve una decisión tipada. La ausencia de política, una interacción inválida o una condición no reconocida se resuelven de forma fail-closed.

Las decisiones públicas son: `ALLOW`, `DENY`, `REQUIRE_CONFIRMATION`, `REQUIRE_REDACTION`, `REQUIRE_CONTEXT` y `UNSUPPORTED`.

## Consecuencias

- Ningún proveedor forma parte del dominio de políticas.
- Las decisiones son puras, reproducibles y auditables mediante códigos seguros.
- Las capacidades todavía no implementadas permanecen deshabilitadas por política.
- 9C podrá consumir estas decisiones como puerta de autorización del ciclo de vida.

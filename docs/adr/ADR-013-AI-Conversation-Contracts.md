# ADR-013 — AI Conversation Contracts

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-010, ADR-011, ADR-012, Milestones 9A–9C

## Problema

La plataforma ya tiene infraestructura transversal para interacciones de IA (contratos, políticas y lifecycle), pero no existe todavía un modelo explícito de conversación como consumidor formal de esa infraestructura.

Sin contratos de Conversation, los módulos futuros podrían introducir modelos inconsistentes de participantes, estados y metadatos conversacionales.

## Contexto

Conversation debe mantenerse como dominio puro, sin dependencias de UI, persistencia o proveedor LLM.

El dominio AI Interaction permanece como capa de infraestructura de interacción. Conversation no puede duplicar policy engine ni lifecycle de interacción.

## Decisión

Introducir `src/intelligence/ai-conversation` como módulo independiente con:

- contratos inmutables de conversación;
- catálogo cerrado de roles conversacionales (`USER`, `ASSISTANT`, `SYSTEM`);
- estado propio de conversación (separado del lifecycle de interacción);
- validadores deterministas fail-closed;
- factory de creación con congelación profunda para asegurar inmutabilidad observable.

## Consecuencias

- Conversation se establece como primer consumidor formal de AI Interaction 9A–9C.
- Se habilita 9E (AI Conversation Session) sobre contratos estables.
- Se evita acoplar reglas conversacionales a infraestructura de proveedor o de interfaz.

## Alternativas descartadas

1. Reusar estado de lifecycle de interacción como estado de conversación: descartado por mezclar conceptos de dominio distintos.
2. Modelar Conversation dentro de AI Interaction: descartado por acoplamiento semántico y menor claridad de límites.
3. Implementar contratos conversacionales directamente en capa UI: descartado por violar DDD y Clean Architecture.

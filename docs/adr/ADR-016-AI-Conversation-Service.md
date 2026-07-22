# ADR-016 — AI Conversation Service

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-013, ADR-014, ADR-015, Milestone 9G

## Problema

Conversation, Session y Message existen como contratos y agregados independientes, pero faltaba una capa de coordinación de dominio para evitar que la UI asumiera reglas operativas conversacionales.

## Contexto

El dominio conversacional requiere un punto de entrada único para crear sesiones, ejecutar transiciones, crear mensajes por rol, incorporarlos a la sesión y exponer lecturas inmutables.

La solución debe reutilizar los contratos y validadores ya certificados sin duplicar máquinas de estado ni lógica interna de agregados.

## Decision

Introducir `AIConversationService` en `src/intelligence/ai-conversation/service` como Domain Service puro y fail-closed con:

- operaciones de sesión (create/activate/pause/resume/complete/cancel);
- creación de mensajes por rol (`USER`, `ASSISTANT`, `SYSTEM`);
- incorporación ordenada de mensajes (`appendMessage`) con validación de pertenencia, secuencia y duplicados;
- consultas inmutables (`getMessages`, `getParticipants`, `getConversationStatus`, `getSessionStatus`);
- integración explícita con Policy Engine y AI Interaction Lifecycle;
- resultados tipados de éxito/fallo para operaciones de servicio.

## Consecuencias

- La lógica de coordinación queda fuera de la UI.
- Se preserva separación entre invariantes de agregados y orquestación de casos de uso.
- Se habilita 9H para construir una interfaz conversacional que solo consuma el servicio.

## Alternativas descartadas

1. Mover coordinación a componentes UI: descartado por romper DDD/Clean Architecture.
2. Expandir Session para actuar como servicio: descartado por mezclar responsabilidades de agregado y orquestación.
3. Duplicar lógica de lifecycle en el servicio: descartado por inconsistencia y riesgo de divergencia.

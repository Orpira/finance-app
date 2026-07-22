# ADR-014 — AI Conversation Session

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-010, ADR-011, ADR-012, ADR-013, Milestone 9E

## Problema

PB-IS-009D definio los contratos de Conversation, pero no existia un agregado que administrara una sesion operativa de conversacion como unidad de trabajo.

Sin esta capa, la activacion, pausa, reanudacion, finalizacion y cancelacion de una conversacion quedaban sin un modelo de dominio unico, determinista y fail-closed.

## Contexto

La sesion debe coordinar Conversation con AI Interaction Policy Engine y AI Interaction Lifecycle sin ejecutar modelos, sin construir prompts, sin memoria, sin persistencia y sin dependencias de infraestructura.

El agregado debe permanecer inmutable y provider-neutral, preservando DDD y Clean Architecture.

## Decision

Introducir `src/intelligence/ai-conversation/session` con:

- agregado raiz `AIConversationSession`;
- `AIConversationSessionId` tipado;
- estados propios de sesion (`CREATED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`);
- eventos y transiciones deterministas de sesion;
- validador fail-closed de contrato y transiciones;
- factory (`createAIConversationSessionId`, `createAIConversationSession`);
- integracion explicita con `AIInteractionPolicyEngine` y `AIInteractionLifecycle` para coordinacion, sin duplicar su logica.

## Consecuencias

- Conversation puede administrarse como sesion activa sin acoplarse a UI, persistencia o proveedor.
- Se mantiene separacion estricta entre estado conversacional (9D), estado de sesion (9E) y lifecycle de interaccion (9C).
- Se habilita 9F para modelar mensajes conversacionales como agregado independiente.

## Alternativas descartadas

1. Reutilizar `AIConversationStatus` como estado de sesion: descartado por mezclar conceptos distintos.
2. Modelar sesion dentro de `ai-interaction`: descartado por invertir ownership de dominio.
3. Orquestar sesion desde UI sin agregado dedicado: descartado por romper DDD, testabilidad y fail-closed.

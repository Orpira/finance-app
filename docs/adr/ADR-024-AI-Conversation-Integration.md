# ADR-024 — AI Conversation Integration

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-022, ADR-023, Milestone 11A

## Problema

Los milestones 10A–10F ya implementaron el motor de IA y su observabilidad, pero la UI conversacional seguía utilizando un flujo temporal basado en `AIConversationService.sendMessage()` con proveedor mock interno.

Eso impedía que la experiencia visible al usuario consumiera la arquitectura certificada de Prompt, Context, Provider, Pipeline e Inspector.

## Contexto

La integración visible para usuario requiere:

- un único punto de entrada de aplicación entre React y el motor de IA;
- Conversation como fuente canónica del historial;
- reutilizar `AIExecutionPipeline` sin exponerlo a la UI;
- mantener `AIExecutionInspector` completamente opcional.

## Decision

Implementar `src/application/ai-conversation` con `AIConversationApplicationService` como único punto de entrada público para la experiencia conversacional.

El Application Service:

- valida la solicitud;
- crea el `userMessage` y actualiza la sesión mediante `AIConversationService`;
- prepara `AIExecutionRequest`;
- invoca `AIExecutionPipeline.execute()`;
- traduce errores del pipeline a errores de aplicación;
- devuelve únicamente la conversación actualizada y mensajes resultantes.

La `ConversationPage` y su controlador consumen exclusivamente este servicio. React no conoce ni `Context Builder`, ni `Prompt Builder`, ni `AIProvider`, ni `AIExecutionPipeline`.

## Decisiones arquitectonicas aplicadas

- DA-024-01: la UI nunca conoce `AIExecutionPipeline`.
- DA-024-02: el único punto de entrada es `AIConversationApplicationService`.
- DA-024-03: Conversation continúa siendo la fuente canónica del estado.
- DA-024-04: el inspector permanece opcional y nunca condiciona la conversación principal.

## Consecuencias

- El primer flujo conversacional extremo a extremo ya usa el motor certificado 10A–10F.
- La UI queda desacoplada de los dominios internos de inteligencia.
- La última traza real del pipeline puede observarse desde Debug sin que la pantalla principal dependa del inspector.

## Alternativas descartadas

1. Invocar `AIExecutionPipeline` directamente desde React: descartado por romper Clean Architecture.
2. Mantener `AIConversationService.sendMessage()` como flujo principal visible: descartado por no usar la arquitectura 10A–10F.
3. Insertar manualmente el mensaje assistant en la UI: descartado porque Conversation debe seguir siendo la única fuente de verdad.

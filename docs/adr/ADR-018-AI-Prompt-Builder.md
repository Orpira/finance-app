# ADR-018 — AI Prompt Builder

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-013, ADR-014, ADR-015, ADR-016, ADR-017, Milestone 10A

## Problema

La plataforma conversacional 9D-9H ya puede crear sesion, mensajes y flujo UI, pero todavia no existe un modelo formal para ensamblar entradas de IA de manera estructurada y provider-neutral.

Sin ese contrato, el sistema corre el riesgo de acoplarse tempranamente a payloads especificos de proveedor.

## Contexto

El roadmap requiere un dominio intermedio entre Conversation y futuros adaptadores de proveedor.

Ese dominio debe:

- representar prompts como agregado estructurado;
- separar roles de prompt de roles conversacionales;
- preservar inmutabilidad, determinismo y fail-closed;
- permitir extension futura por Context Builder (10B) sin romper contratos.

## Decision

Implementar `src/intelligence/prompt-builder` con:

- contratos canonicos (`AIPrompt`, `AIPromptSegment`, `AIPromptRole`, `AIPromptPriority`, `AIPromptMetadata`);
- validador determinista fail-closed para prompt y segmentos;
- factory inmutable (`createPromptId`, `createPromptSegment`, `createPrompt`);
- builder de dominio (`createPrompt`, `addSegment`, `removeSegment`, `sortSegments`, `build`);
- adaptador basico desde `AIConversationMessage` a `AIPromptSegment`.

El `build()` devuelve `AIPrompt` validado, nunca un `string` ni payload de proveedor.

## Decision especifica sobre roles

Se define un set propio de roles de prompt:

- `SYSTEM`
- `USER`
- `ASSISTANT`
- `CONTEXT`
- `CONSTRAINT`

No se reutiliza directamente `AIConversationRole` porque Prompt Builder necesita segmentos no conversacionales (`CONTEXT`, `CONSTRAINT`) y debe conservar independencia semantica respecto a la sesion conversacional.

## Consecuencias

- Se habilita 10B (Context Builder) con un contrato canónico ya estable.
- Conversation puede aportar segmentos, pero no define la estructura completa del prompt.
- El dominio permanece sin dependencias de UI, red, proveedor, tokenizacion o persistencia.
- Los adaptadores OpenAI/Gemini/Claude quedaran como capas posteriores sobre `AIPrompt`.

## Alternativas descartadas

1. Prompt como `string` unico: descartado por perdida de estructura y trazabilidad.
2. Reutilizar `AIConversationRole`: descartado por alcance semantico insuficiente.
3. Generar payload de proveedor en 10A: descartado por romper provider-neutrality y contract-first.

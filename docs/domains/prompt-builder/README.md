# Dominio Prompt Builder

**Estado:** Active — Milestone 10A

## Objetivo

Construir una representacion canónica de prompt para IA como agregado de dominio tipado, inmutable y provider-neutral.

## Incluido en 10A

- Contratos del dominio (`AIPrompt`, `AIPromptSegment`, `AIPromptRole`, `AIPromptPriority`, `AIPromptMetadata`).
- Segmentos ordenados por insercion y ordenables por prioridad.
- Factory inmutable (`createPromptId`, `createPromptSegment`, `createPrompt`).
- Validator fail-closed para prompt, segmento, roles, prioridades, metadata y orden consistente.
- Builder (`createPrompt`, `addSegment`, `removeSegment`, `sortSegments`, `build`) que devuelve `AIPrompt` validado.
- Integracion basica con mensaje conversacional mediante mapeo controlado a segmento.

## Excluido

Context Builder, memoria, ejecucion de proveedor, tokenizacion, streaming, tool calling y persistencia.

## Roles de Prompt

- `SYSTEM`
- `USER`
- `ASSISTANT`
- `CONTEXT`
- `CONSTRAINT`

Prompt Builder define roles propios porque no todo segmento representa un mensaje de conversacion.

## API publica

`src/intelligence/prompt-builder/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos internos. Sin React, sin SDKs de proveedor, sin red y sin almacenamiento.

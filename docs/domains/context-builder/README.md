# Dominio Context Builder

**Estado:** Active — Milestone 10B

## Objetivo

Construir un contrato canónico de contexto para IA como agregado estructurado, inmutable y provider-neutral.

## Incluido en 10B

- Contratos del dominio (`AIContext`, `AIContextSection`, `AIContextSource`, `AIContextPriority`, `AIContextMetadata`).
- Factory inmutable (`createContextId`, `createContextSection`, `createContext`).
- Validator fail-closed para estructura, source, prioridad, metadata y orden.
- Builder (`createContext`, `addSection`, `removeSection`, `sortSections`, `build`) que retorna `AIContext` validado.
- Mapeo basico desde Conversation Message y Session a secciones de contexto.

## Excluido

Prompt rendering, memoria, semantic search, embeddings, OCR, RAG, tool calling, token estimation, persistencia y ejecucion de proveedor.

## Sources actuales

- `CONVERSATION`
- `SESSION`
- `USER_PROFILE`
- `APPLICATION`
- `FINANCIAL_DATA`
- `CONFIGURATION`

## API publica

`src/intelligence/context-builder/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos internos de dominio. Sin React, sin HTTP, sin SDKs de proveedor y sin persistencia.

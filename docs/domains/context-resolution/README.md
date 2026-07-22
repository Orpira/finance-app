# Dominio Context Resolution

**Estado:** Active — Milestone 10C

## Objetivo

Resolver de forma determinista el subconjunto relevante de `AIContext` para una interaccion concreta, produciendo `AIResolvedContext` inmutable.

## Incluido en 10C

- Contratos `AIResolvedContext` y `AIResolvedSection`.
- Estrategias de resolucion tipadas.
- Resolver centralizado con inclusion, exclusion y priorizacion determinista.
- Factory inmutable para secciones/contexto resuelto.
- Validator fail-closed para estrategia, metadata, secciones y orden.

## Estrategias actuales

- `DEFAULT`
- `MINIMAL`
- `CONVERSATION_ONLY`
- `APPLICATION_ONLY`
- `FINANCIAL_ONLY`

## Excluido

Prompt building, adaptadores de proveedor, memoria, RAG, embeddings, persistencia y UI.

## API publica

`src/intelligence/context-resolution/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos internos de dominio (`context-builder`). Sin React, HTTP ni SDKs externos.

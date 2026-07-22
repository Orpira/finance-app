# Dominio Execution Pipeline

**Estado:** Active — Milestone 10E

## Objetivo

Coordinar de forma determinista el flujo `Conversation -> Context Builder -> Context Resolution -> Prompt Builder -> AIProvider -> Conversation` sin introducir lógica de negocio adicional.

## Incluido en 10E

- Contratos `AIExecutionRequest`, `AIExecutionResponse` y `AIExecutionMetadata`.
- Validator fail-closed para request, response, metadata, conversation, session y user message.
- Factory inmutable (`createExecutionId`, `createExecutionRequest`, `createExecutionResponse`).
- Orquestador `AIExecutionPipeline` con única operación pública `execute()`.
- Dependencias invertidas mediante puertos explícitos hacia Context Builder, Context Resolver, Prompt Builder, Conversation Service y `AIProvider`.

## Excluido

Streaming, tool calling, vision, memoria, OCR, RAG, cache, retries automáticos, colas, background jobs y detalles específicos del proveedor.

## API publica

`src/intelligence/execution-pipeline/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos públicos de `ai-conversation`, `context-builder`, `context-resolution`, `prompt-builder` y `provider`. Sin React, sin HTTP, sin SDKs externos y sin acceder a implementaciones internas de otros dominios.

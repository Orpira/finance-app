# Dominio Provider Adapter

**Estado:** Active — Milestone 10D

## Objetivo

Adaptar `AIPrompt` a proveedores LLM externos mediante una interfaz estable, inmutable y provider-neutral, devolviendo siempre `AIProviderResponse` canónico.

## Incluido en 10D

- Contratos `AIProvider`, `AIProviderRequest`, `AIProviderResponse` y `AIProviderCapabilities`.
- Validator fail-closed para ids, metadata, capabilities, request y response.
- Factory inmutable (`createProviderRequestId`, `createProviderResponseId`, `createProviderRequest`, `createProviderResponse`).
- Resolución centralizada de proveedores (`createProvider`, `resolveProvider`).
- Adaptador OpenAI con traducción `AIPrompt -> payload OpenAI -> AIProviderResponse`.
- Traducción de errores externos a códigos tipados del dominio.

## Excluido

Streaming, tool calling, vision, audio, embeddings, memoria, cache, observabilidad, retries avanzados y persistencia.

## API publica

`src/intelligence/provider/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos internos (`prompt-builder`). Sin React, sin UI, sin Conversation, sin Context Builder/Resolution y sin exponer SDKs externos como contrato público.

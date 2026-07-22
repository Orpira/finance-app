# ADR-022 — AI Execution Pipeline

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-018, ADR-019, ADR-020, ADR-021, Milestone 10E

## Problema

Private Balance ya dispone de dominios especializados para Conversation, Context Builder, Context Resolution, Prompt Builder y Provider Adapter, pero todavía no existía un coordinador único que los ejecutara como un flujo estable y determinista.

Sin esa capa, la integración quedaría dispersa y con riesgo de duplicar lógica de orquestación en servicios o UI.

## Contexto

La arquitectura AI Core requiere una capa que coordine exclusivamente:

- session conversacional de entrada;
- construcción de contexto;
- resolución de contexto;
- construcción de prompt;
- invocación de proveedor;
- incorporación del assistant message a la conversación.

Esa capa no debe construir contexto, resolverlo ni interpretar lógica de proveedor. Solo debe delegar en fronteras públicas existentes.

## Decision

Implementar el dominio `src/intelligence/execution-pipeline` con:

- contratos canónicos `AIExecutionRequest`, `AIExecutionResponse` y `AIExecutionMetadata`;
- validator fail-closed para request, response, metadata, conversación, sesión y user message;
- factory inmutable (`createExecutionId`, `createExecutionRequest`, `createExecutionResponse`);
- orquestador `AIExecutionPipeline` con una única operación pública `execute()`;
- dependencias invertidas mediante puertos explícitos para Context Builder, Context Resolver, Prompt Builder, Conversation Service y `AIProvider`.

El pipeline exige como invariante que la sesión de entrada ya contenga el `userMessage` como último mensaje; de este modo el orquestador se limita a crear y anexar el assistant message resultante del proveedor.

## Decisiones arquitectonicas aplicadas

- DA-022-01: el pipeline nunca construye contexto directamente.
- DA-022-02: el pipeline nunca resuelve contexto directamente.
- DA-022-03: el pipeline nunca construye prompts directamente.
- DA-022-04: el pipeline nunca conoce detalles del proveedor.
- DA-022-05: el pipeline no interpreta la respuesta del modelo más allá de incorporarla al flujo conversacional.

## Consecuencias

- La orquestación queda centralizada sin introducir lógica de negocio adicional.
- Conversation, Context, Prompt y Provider permanecen cohesionados y desacoplados.
- Se habilita 10F sobre una frontera de ejecución estable.
- Las pruebas pueden usar dobles de cada colaborador sin llamadas reales a proveedor ni UI.

## Alternativas descartadas

1. Reutilizar `sendMessage()` de `AIConversationService`: descartado porque mezcla reply provider mock de 9H con la nueva orquestación de 10E.
2. Construir `AIContext` o `AIPrompt` dentro del pipeline: descartado por violar SRP y DIP.
3. Actualizar conversación desde la UI o composition root: descartado por romper límites de dominio y dispersar la coordinación.

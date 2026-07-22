# ADR-025 — AI Provider Production Activation

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-021, ADR-024, Milestone 11B

## Problema

El sistema ya disponía de `OpenAIProviderAdapter` certificado en 10D y de una conversación integrada en 11A, pero la composition root principal seguía usando un provider preview local.

Eso impedía activar un proveedor remoto real sin exponer credenciales en el frontend y abría el riesgo de duplicar el adapter ya certificado.

## Contexto

11B debía resolver únicamente:

- activación del provider de producción;
- composición segura del adapter ya certificado;
- validación fail-closed de configuración;
- ausencia de fallback silencioso a preview.

## Decision

Mantener sin cambios el `OpenAIProviderAdapter` de `src/intelligence/provider/openAIProviderAdapter.ts` y reutilizarlo exclusivamente mediante composición en `src/application/ai-conversation/aiConversationApplicationComposition.ts`.

La composition root principal ahora:

- resuelve configuración pública mínima (`VITE_AI_PROVIDER`, `VITE_AI_OPENAI_MODEL`, `VITE_AI_OPENAI_TIMEOUT_MS`);
- obtiene autorización temporal reutilizando el gateway existente de licencias/automatización;
- invoca un proxy serverless autorizado `api/ai-provider-openai.ts`;
- conserva `OPENAI_API_KEY` exclusivamente en entorno servidor/edge;
- falla en cerrado cuando la configuración es inválida o faltan credenciales;
- no realiza fallback automático al provider preview.

El preview queda reservado solo para pruebas o demos explícitas.

## Consecuencias

- No se duplica infraestructura 10D.
- El cliente nunca empaqueta la API key.
- El pipeline 10E y el inspector 10F permanecen intactos.
- Conversation sigue dependiendo solo de abstracciones y del Application Service.

## Alternativas descartadas

1. Crear un segundo adapter OpenAI para producción: descartado por duplicación de infraestructura certificada.
2. Inyectar la API key por `VITE_` o en el bundle: descartado por violar el límite de seguridad.
3. Mantener fallback silencioso a preview: descartado por ocultar errores de configuración y degradar la integridad de la integración.

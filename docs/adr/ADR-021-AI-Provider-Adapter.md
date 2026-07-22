# ADR-021 — AI Provider Adapter

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-018, ADR-019, ADR-020, Milestone 10D

## Problema

Prompt Builder 10A, Context Builder 10B y Context Resolution 10C ya permiten producir contratos internos canónicos para una interacción de IA, pero todavía no existía una frontera estable para ejecutar esos contratos contra un proveedor externo.

Sin esa capa, el dominio corría el riesgo de acoplarse a payloads, errores y capacidades específicas de OpenAI u otros proveedores.

## Contexto

La arquitectura AI Core requiere separar claramente:

- construcción de prompt canónico (`AIPrompt`);
- adaptación a payload de proveedor;
- ejecución del proveedor;
- traducción de respuesta externa a contrato interno estable.

10D cubre exclusivamente esa frontera provider-neutral sin introducir streaming, tools, vision, audio, embeddings ni memoria.

## Decision

Implementar el dominio `src/intelligence/provider` con:

- interfaz estable `AIProvider`;
- contratos canónicos `AIProviderRequest`, `AIProviderResponse` y `AIProviderCapabilities`;
- validator fail-closed para request, response, metadata, capabilities e ids;
- factory inmutable para ids, requests y responses;
- factory de resolución centralizada (`createProvider`, `resolveProvider`);
- adaptador concreto `OpenAI` que traduce `AIPrompt` a payload de chat completions y devuelve `AIProviderResponse`;
- traducción explícita de errores externos a códigos tipados del dominio.

La implementación concreta de OpenAI queda encapsulada detrás de `AIProvider` y opera mediante transporte inyectable para mantener pruebas puras y evitar dependencia del SDK en el núcleo del dominio.

## Decisiones arquitectonicas aplicadas

- DA-021-01: el dominio nunca depende del SDK del proveedor.
- DA-021-02: cada proveedor implementa la misma interfaz `AIProvider`.
- DA-021-03: request y response pertenecen al dominio de Private Balance, no al proveedor.
- DA-021-04: agregar un nuevo proveedor debe implicar un nuevo adaptador, sin modificar Conversation, Context Builder, Context Resolution ni Prompt Builder.

## Consecuencias

- El dominio permanece desacoplado de OpenAI, HTTP, fetch, React y payloads externos.
- Capas superiores pueden consultar capacidades del proveedor sin conocer detalles del adaptador.
- Se habilita 10E sobre una interfaz estable de ejecución sin romper 10A–10C.
- Los tests pueden mockear transporte y errores sin llamadas reales a red.

## Alternativas descartadas

1. Invocar OpenAI directamente desde Conversation o Prompt Builder: descartado por romper provider-neutrality y DIP.
2. Exponer payloads de proveedor como contrato público: descartado por acoplar el dominio a formatos externos.
3. Instalar y usar SDK de proveedor como dependencia del núcleo: descartado por aumentar acoplamiento y dificultar pruebas deterministas.

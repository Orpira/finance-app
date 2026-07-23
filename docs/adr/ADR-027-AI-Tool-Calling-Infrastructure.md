# ADR-027 - AI Tool Calling Infrastructure

Estado: Accepted  
Version: 1.0  
Fecha: 2026-07-23  
Relacionado: ADR-021, ADR-022, ADR-024, ADR-026, Milestone 11D

## Problema

El flujo conversacional podia generar solo texto. No existia una infraestructura estandar para que el modelo solicitara capacidades de sistema bajo control de aplicacion.

## Contexto

Private Balance necesitaba habilitar tool calling sin romper fronteras certificadas:

- Provider Adapter mantiene su responsabilidad de ejecucion de prompts.
- Execution Pipeline mantiene orquestacion determinista.
- Conversation y Conversation Memory no deben mezclarse con implementaciones de herramientas.
- La infraestructura debe ser extensible y fail-closed.

## Decision

Se implementa un dominio nuevo `src/intelligence/ai-tools` con contratos provider-neutral:

- `AITool`
- `AIToolDefinition`
- `AIToolRegistry`
- `AIToolExecutor`
- `AIToolExecutionRequest`
- `AIToolExecutionResult`
- `AIToolFailure`
- `AIToolFailureCode`
- `AIToolContext`

Se aplica Registry Pattern para descubrimiento dinamico y validacion de duplicados.

Se aplica Command Pattern para ejecutar herramientas mediante `AIToolExecutionRequest` explicito.

Se aplica Strategy Pattern para incorporar nuevas herramientas via implementaciones de `AITool` sin cambiar pipeline, provider ni conversation.

`AIExecutionPipeline` se extiende por composicion con una dependencia opcional a `AIToolExecutor`:

1. Ejecuta provider request normal.
2. Si la respuesta del modelo contiene envelope `tool_call` valido, construye `AIToolExecutionRequest` y ejecuta herramienta.
3. Enriquce el prompt con `tool_result` y realiza una segunda invocacion al provider.
4. Devuelve respuesta final al flujo conversacional.

Se agrega `PingTool` como unica herramienta demo (`{}` -> `"PONG"`) para demostrar:

- registro;
- resolucion;
- ejecucion;
- respuesta final del provider.

## Decisiones arquitectonicas aplicadas

- DA-027-01: El pipeline solo conoce `AIToolExecutor` para tool calling.
- DA-027-02: El provider no ejecuta herramientas.
- DA-027-03: El registro de herramientas es central y desacoplado.
- DA-027-04: Agregar una herramienta requiere implementacion + registro, sin modificar pipeline.
- DA-027-05: Los niveles de permiso (`read-only`, `write`, `dangerous`, `future-confirmation-required`) forman parte del contrato.
- DA-027-06: Toda validacion es fail-closed para nombre, schema, argumentos y resultado.

## Consecuencias

- La plataforma queda preparada para herramientas reales sin acoplar negocio en 11D.
- La UI conversacional mantiene su comportamiento y su frontera de aplicacion.
- Se habilita PB-IS-011E sobre una infraestructura de extensibilidad controlada.

## Alternativas descartadas

1. Ejecutar herramientas directamente en el provider: descartado por acoplamiento y perdida de control de permisos.
2. Ejecutar herramientas desde UI/controller: descartado por violar Clean Architecture.
3. Inyectar herramientas concretas en pipeline: descartado por romper Open/Closed.

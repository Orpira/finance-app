# ADR-023 — AI Execution Inspector

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-021, ADR-022, Milestone 10F

## Problema

El pipeline 10E ya coordina correctamente la ejecución de IA, pero no existía una forma estructurada de inspeccionar qué contrato fue construido en cada etapa ni qué información fue descartada o transformada durante la orquestación.

Sin esa observabilidad, depurar respuestas inesperadas requería reconstrucción manual del flujo o instrumentación ad hoc.

## Contexto

La arquitectura necesita una capacidad de observación que:

- no modifique el comportamiento del pipeline;
- no introduzca side effects ni persistencia;
- capture exclusivamente contratos de dominio públicos;
- permanezca opcional y desacoplada.

## Decision

Implementar el dominio `src/intelligence/execution-inspector` con:

- contratos `AIExecutionTrace`, `AIExecutionStage` y `AIExecutionSnapshot`;
- validator fail-closed para traza, etapas, snapshots, orden y timestamps;
- factory inmutable (`createTrace`, `createStage`, `createSnapshot`);
- inspector pasivo `AIExecutionInspector` con `beginTrace`, `captureStage`, `finishTrace` y `exportTrace`;
- integración opcional por composición en `AIExecutionPipeline` 10E;
- view model puro para una pantalla Debug de solo lectura.

El pipeline emite eventos al inspector pero nunca consulta su estado durante la ejecución. Toda falla del inspector queda aislada del flujo principal.

## Decisiones arquitectonicas aplicadas

- DA-023-01: el inspector nunca participa en la lógica de ejecución.
- DA-023-02: los snapshots almacenan exclusivamente contratos de dominio públicos.
- DA-023-03: la observabilidad es opcional y el pipeline sigue funcionando sin inspector.
- DA-023-04: la UI consume únicamente `AIExecutionTrace` exportado, nunca el pipeline directamente.

## Consecuencias

- El motor de IA gana observabilidad para desarrollo sin comprometer contract-first ni provider-neutrality.
- La depuración de etapas queda desacoplada de UI, proveedor y persistencia.
- Se prepara la base para milestones posteriores con memoria, RAG o múltiples proveedores manteniendo una vista completa de la ejecución.

## Alternativas descartadas

1. Logging directo dentro del pipeline: descartado por mezclar observabilidad con orquestación.
2. Persistir trazas automáticamente: descartado por alcance y por introducir side effects no deseados.
3. Leer estado interno del pipeline desde la UI: descartado por romper encapsulación y el principio read-only.

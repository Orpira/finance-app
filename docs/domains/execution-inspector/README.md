# Dominio Execution Inspector

**Estado:** Active — Milestone 10F

## Objetivo

Observar una ejecución completa del pipeline de IA mediante snapshots inmutables y de solo lectura, sin modificar el comportamiento del flujo principal.

## Incluido en 10F

- Contratos `AIExecutionTrace`, `AIExecutionStage` y `AIExecutionSnapshot`.
- Validator fail-closed para traza, etapas, snapshots, orden y timestamps.
- Factory inmutable (`createTrace`, `createStage`, `createSnapshot`).
- Inspector pasivo con `beginTrace`, `captureStage`, `finishTrace` y `exportTrace`.
- View model puro para UI Debug.
- Integración opcional por composición con `AIExecutionPipeline`.

## Excluido

Persistencia, telemetría remota, analytics, profiling, logs externos y cualquier comportamiento productivo.

## API publica

`src/intelligence/execution-inspector/index.ts`

## Dependencias permitidas

Solo TypeScript y contratos públicos de `ai-conversation`, `context-builder`, `context-resolution`, `execution-pipeline`, `prompt-builder` y `provider`. Sin React dentro del dominio, sin SDKs externos y sin side effects.

# 24. Insight Read Models

## Proposito

Milestone 7E define una frontera de lectura para proyectar exclusivamente la respuesta publica del Insight Runtime hacia DTOs optimizados para consumo de UI.

La proyeccion es determinista, readonly, JSON-safe e inmutable, sin exponer el dominio interno del Insight Engine.

## Alcance De 7E

Implementado:

- `createInsightReadModels` como proyector de lectura sin estado
- contratos publicos de read model en `readModelInterfaces.ts`
- proyeccion de resumen general
- lista plana de insights para rendering
- agrupacion por categoria
- agrupacion por severidad
- estadisticas globales de lectura
- indicadores de confianza
- metadatos de actualizacion
- trazabilidad minima para navegacion de UI

No implementado en 7E:

- ejecucion de reglas
- mutacion de insights
- acceso a Builder, Validator, Repository u Orchestrator
- acceso a Runtime interno o Runtime Adapter interno
- acceso a Dexie o IndexedDB
- persistencia
- componentes React o rendering
- logica financiera
- logica de negocio
- IA/LLM

## Arquitectura

Insight Runtime

-> Insight Read Models

-> UI / Dashboard

## Contratos Nuevos

- `src/services/readModelInterfaces.ts`
- `src/services/insightReadModels.ts`

DTOs principales:

- `InsightReadModelProjection`
- `InsightReadModelInsight`
- `InsightReadModelSummary`
- `InsightReadModelStatistics`
- `InsightReadModelConfidenceIndicators`
- `InsightReadModelUpdateMetadata`
- `InsightReadModelTraceabilityItem`

## API

`createInsightReadModels().project(runtimeResponse)`

Entrada permitida:

- `InsightRuntimeResponse` publico (`success` o `failure`)

Salida:

- projection `ok: true` con DTOs de lectura
- failure `ok: false` para respuestas runtime invalidas de frontera

## Flujo De Proyeccion

1. valida forma minima de `InsightRuntimeResponse`
2. lee insights y ejecuciones solo desde respuesta publica de runtime
3. proyecta lista readonly de insights con campos de consumo
4. construye agrupaciones por categoria y severidad
5. calcula estadisticas y confianza sin ejecutar reglas
6. preserva trazabilidad minima por insight
7. construye metadata de actualizacion para UI
8. congela profundamente la salida para asegurar inmutabilidad observable

## Determinismo E Inmutabilidad

- no usa fecha/hora ni aleatoriedad
- misma entrada produce la misma salida
- no muta la respuesta runtime de entrada
- salida congelada profundamente (`Object.freeze` recursivo)

## Trazabilidad

Cada insight proyectado conserva:

- `insightId`
- `ruleId` y `ruleVersion`
- `knowledgeCollectionId`
- `sourceSnapshotId`
- `sourceSnapshotKey`
- `sourceSnapshotRevision`
- `factIds`

Esta trazabilidad permite navegacion UI hacia el contexto de origen sin exponer estructuras internas del dominio.

## Fail-Closed

Si la entrada no cumple contrato publico minimo, el read model retorna:

- `ok: false`
- `code: READ_MODEL_INVALID_RUNTIME_RESPONSE`
- `deterministic: true`
- `failClosed: true`

No se intenta reparacion automatica ni inferencias no deterministas.

## Suite Unitaria 7E

Cobertura incluida:

- proyeccion correcta
- determinismo
- coleccion vacia
- trazabilidad preservada
- estadisticas coherentes
- datos no mutados
- salida inmutable
- runtime failure proyectado para UI
- respuesta runtime invalida fail-closed
- ausencia de acceso al nucleo interno
- ausencia de logica de negocio

## Riesgos Conocidos

- 7E depende de estabilidad contractual del `InsightRuntimeResponse` publico.
- Si runtime rompe contrato de frontera, la proyeccion falla de forma cerrada.
- 7E no resuelve semantica de negocio; solo organiza lectura para UI.

## Pasos Futuros No Implementados

- adaptadores de paginacion para vistas complejas
- serializadores de transporte para API externa
- cache de lectura en capa de infraestructura
- mapeadores de presentacion especificos por pantalla

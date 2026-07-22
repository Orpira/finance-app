# 23. Insight Execution Service

## Proposito

Milestone 7D implementa el servicio de aplicacion que coordina las fronteras 7B y 7C para ejecutar el pipeline completo:

FinancialSnapshot canonico -> Snapshot Knowledge Integration -> KnowledgeCollection -> Knowledge Integration -> Runtime Adapter -> Insight Runtime

El servicio no reimplementa reglas de 7B ni 7C. Solo orquesta, valida frontera publica y aplica fail-closed.

## Diferencia Frente A 6F, 6G Y 7A

- 6F (Insight Engine Orchestrator): coordina Builder/Validator/Repository dentro del nucleo Insight, sin conocer Snapshot Integration ni Knowledge Integration.
- 6G (Insight Runtime): expone la API publica de ejecucion/consulta del motor Insight; no coordina Snapshot -> Knowledge.
- 7A (Runtime Adapter): adapta KnowledgeCollection hacia Runtime; no ejecuta Snapshot Integration.
- 7D (Insight Execution Service): compone 7B y 7C como pipeline de aplicacion sin acceder al nucleo interno de Insight.

## Composicion 7B + 7C

1. Invoca `SnapshotKnowledgeIntegration.integrate` con `integrationId`, `snapshot` y `versions`.
2. Si 7B falla, detiene el flujo.
3. Si 7B tiene exito, usa solo la `KnowledgeCollection` certificada.
4. Construye request publico de 7C y ejecuta `KnowledgeIntegration.integrate`.
5. Si 7C falla, retorna failure sin exito parcial.
6. Si 7C tiene exito, retorna success con respuesta publica de runtime y trazabilidad completa.

## Contratos Publicos Nuevos

- `src/services/insightExecutionResult.ts`
- `src/services/insightExecutionInterfaces.ts`
- `src/services/insightExecutionService.ts`

Contratos principales:

- `InsightExecutionRequest`
- `InsightExecutionResult`
- `InsightExecutionSuccess`
- `InsightExecutionFailure`
- `InsightExecutionFailureCode`
- `InsightExecutionStage`
- `InsightExecutionTraceability`
- puertos `InsightExecutionSnapshotIntegrationPort` y `InsightExecutionKnowledgeIntegrationPort`

## Dependencias Permitidas

- Puertos publicos de 7B (`SnapshotKnowledgeIntegration`)
- Puertos publicos de 7C (`KnowledgeIntegration`)
- Tipos publicos de Snapshot, Knowledge, InsightRule y resultados de frontera

## Dependencias Prohibidas

- `createInsightRuntime`
- `createRuntimeAdapter`
- Builder, Validator, Repository, Orchestrator internos
- Dexie, IndexedDB, API remota, backend
- React/UI
- IA/LLM
- cache, reintentos, sincronizacion, scheduler, eventos

## API Del Servicio

`createInsightExecutionService(dependencies).execute(request)`

Caracteristicas:

- determinista
- sin estado global
- sin singleton
- inyectable por puertos
- fail-closed en todas las rutas
- respuesta discriminada explicita (`success`/`failure`)

## Failure Codes 7D

- `INSIGHT_EXECUTION_INVALID_REQUEST`
- `INSIGHT_EXECUTION_MISSING_SNAPSHOT`
- `INSIGHT_EXECUTION_MISSING_RULE_CATALOG`
- `INSIGHT_EXECUTION_MISSING_DEPENDENCY`
- `INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED`
- `INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED`
- `INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_EXCEPTION`
- `INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_EXCEPTION`
- `INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT`
- `INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT`
- `INSIGHT_EXECUTION_TRACEABILITY_MISMATCH`
- `INSIGHT_EXECUTION_PIPELINE_FAILURE`

## Flujo Exitoso

1. valida request de frontera publica (snapshot, reglas, metadatos, versiones)
2. valida dependencias inyectadas
3. ejecuta 7B una sola vez
4. valida consistencia de salida/trazabilidad de 7B
5. ejecuta 7C una sola vez
6. valida consistencia de salida/trazabilidad de 7C
7. retorna success con respuesta publica de runtime y trazabilidad completa

## Flujos De Fallo

Fallo antes de etapas:

- request invalido o incompleto
- dependencia ausente

Fallo en etapa 7B:

- rejection de 7B
- excepcion controlable de 7B
- resultado nulo o inconsistente de 7B
- mismatch de trazabilidad snapshot -> knowledge

Fallo en etapa 7C:

- rejection de 7C
- excepcion controlable de 7C
- resultado nulo o inconsistente de 7C
- mismatch de trazabilidad knowledge -> runtime

En todos los fallos:

- sin exito parcial
- sin reintentos
- sin mutar entradas
- retorno failure estable y JSON-safe

## Fail-Closed

El servicio nunca convierte errores en exito.

Las excepciones de puertos se traducen a `InsightExecutionFailure` estable con `causeCode` y `details` seguros (`errorName`, `errorMessage`) sin stack trace.

## Atomicidad Logica

Atomicidad logica para consumidor:

- si falla 7B, 7C no se ejecuta
- si falla 7C, no hay success
- cada etapa se ejecuta como maximo una vez

Distincion importante:

- 7D no garantiza transacciones de almacenamiento porque la persistencia esta fuera de alcance

## Trazabilidad

`InsightExecutionTraceability` conserva, cuando existe:

- `executionId`
- `snapshotIntegrationId`
- `knowledgeIntegrationId`
- identidad/version del snapshot de entrada
- trazabilidad publica de 7B
- trazabilidad publica de 7C
- relacion determinista entre snapshot, knowledge y runtime

## Inmutabilidad

El servicio evita mutacion observable de:

- request
- snapshot
- catalogo de reglas
- resultado de 7B
- knowledge collection de 7B
- resultado de 7C

Decision aplicada:

- clonacion defensiva solo en limites de invocacion y salida para impedir side-effects de dobles/dependencias
- no se introducen estructuras paralelas ni transformaciones de dominio fuera de la orquestacion

## Determinismo

No usa `Date.now()`, UUID aleatorio ni fuentes ambientales.

Misma entrada con mismos dobles produce el mismo `InsightExecutionResult`.

## Ejemplo De Consumo Sin UI

1. Construir `InsightExecutionRequest` con snapshot canonico, reglas y metadatos de integracion.
2. Inyectar puertos publicos de 7B y 7C.
3. Ejecutar `execute(request)`.
4. Consumir union discriminada:
   - `ok: true` para runtime response + traceability
   - `ok: false` para codigo, etapa y datos de fallo

## Riesgos Conocidos

- Si un puerto retorna contratos semanticamente validos pero con trazabilidad incorrecta, 7D rechaza por fail-closed.
- 7D depende de que 7B/7C mantengan estabilidad de contratos publicos.
- No existe compensacion transaccional porque no hay persistencia en alcance.

## Pasos Futuros No Implementados

- Facade de aplicacion para lotes de snapshots (fuera de 7D)
- politicas de retry externas al dominio (fuera de 7D)
- observabilidad operacional de pipeline en capa de infraestructura (fuera de 7D)
- acoplamiento con consumidores UI (fuera de 7D)

# 20. Insight Runtime

## Proposito

Milestone 6G implementa la frontera estable de aplicacion del Insight Engine.

El Runtime encapsula al Orchestrator para que los consumidores ejecuten el motor y consulten estado sin conocer Builder, Validator o Repository internos.

## Alcance De 6G

Implementado:

- API publica estable `createInsightRuntime`
- contrato de ejecucion `InsightRuntimeRequest`
- contrato de respuesta `InsightRuntimeResponse` con `InsightRuntimeSuccess` y `InsightRuntimeFailure`
- codigos de fallo estables `InsightRuntimeFailureCode`
- consultas de lectura sobre el estado actual (`getSnapshot`, `getAll`, `getById`, `query`, `count`, `exists`)
- delegacion estricta al `InsightEngine` para ejecucion
- delegacion estricta al `InsightRepository` para consultas
- traduccion fail-closed de fallos controlables
- preservacion del estado de Repository ante fallo

No implementado en 6G:

- persistencia
- Dexie
- IndexedDB
- UI / React
- IA / LLM
- red / backend
- scheduler
- eventos
- singletons

## Arquitectura

Application Consumer

-> InsightRuntime

-> InsightEngine Orchestrator

-> InsightBuilder

-> InsightValidator

-> InsightRepository

## Contratos Nuevos

- `src/insight/runtimeInterfaces.ts`
- `src/insight/runtimeRequest.ts`
- `src/insight/runtimeResponse.ts`
- `src/insight/insightRuntime.ts`

## Modelo Operativo

`createInsightRuntime` recibe dependencias inyectables:

- `orchestrator?: InsightEngine`
- `repository?: InsightRepository`

`execute(request)`:

1. valida estructura del request y protocol version
2. valida compatibilidad minima de `KnowledgeCollection`
3. valida catalogo de reglas fail-closed
4. delega a `orchestrator.run`
5. valida consistencia de `InsightEngineResult`
6. actualiza `repository` solo en exito aceptado
7. traduce rechazo de validacion a failure de dominio

Consultas:

- `getSnapshot`: estado agregado del repository actual
- `getAll`, `getById`, `count`, `exists`: lecturas directas
- `query`: adaptador sobre consultas existentes del repository (`by-category`, `by-severity`, `by-status`, `by-scope`, `by-rule`, `by-confidence`, `statistics`)

## Fail-Closed

El Runtime rechaza de forma determinista cuando detecta:

- request nulo o invalido
- `KnowledgeCollection` incompatible
- catalogo de reglas invalido
- dependencias faltantes
- excepcion al invocar Orchestrator
- `ValidationReport` invalido
- resultado inconsistente del Orchestrator

En fallo:

- no actualiza repository
- no retorna exito parcial
- devuelve `InsightRuntimeFailure` con code estable
- conserva estado previo

## Suite Unitaria 6G

Cobertura incluida:

- ejecucion exitosa
- delegacion unica al orchestrator
- respuesta determinista
- validacion rechazada
- request invalido
- knowledge incompatible
- catalogo invalido
- fallo controlado de orchestrator
- repository actualizado en exito
- repository intacto en fallo
- `getSnapshot`
- `getAll`
- `getById`
- `query` delegada al repository
- `count`
- `exists`
- coleccion vacia
- dependencias faltantes
- fail-closed
- misma entrada + mismo estado => misma salida
- runtime sin logica duplicada del repository
- runtime sin ejecucion directa de Builder/Validator

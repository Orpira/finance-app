# 21. Runtime Adapter

## Proposito

Milestone 7A implementa el Runtime Adapter como frontera de integracion entre el Knowledge Layer y el Insight Runtime.

El Adapter recibe un snapshot sellado, construye una KnowledgeCollection valida con contratos existentes y delega la ejecucion exclusivamente a la API publica del Runtime.

## Alcance De 7A

Implementado:

- `createRuntimeAdapter` como servicio de integracion determinista
- adaptacion `Financial Snapshot -> KnowledgeCollection(validated) -> InsightRuntimeRequest`
- invocacion exclusiva de `runtime.execute`
- resultado de integracion estable con propagacion de respuestas del Runtime
- traduccion fail-closed de fallos de adaptacion
- puertos inyectables para Runtime, Builder y Validator

No implementado en 7A:

- ejecucion directa de reglas
- validacion de reglas en el Adapter
- acceso directo a Repository, Builder o Validator del Insight Engine
- logica de negocio financiera
- UI / React
- IndexedDB / Dexie directo
- IA / LLM

## Arquitectura

Financial Snapshot

-> Knowledge Layer

-> Runtime Adapter

-> Insight Runtime

## Contratos Nuevos

- `src/services/adapterInterfaces.ts`
- `src/services/runtimeAdapter.ts`

## Modelo Operativo

`adaptAndExecute(input)` ejecuta en orden:

1. valida forma minima del input
2. construye DraftKnowledgeCollection con `buildKnowledgeCollectionFromSnapshot`
3. valida a `ValidatedKnowledgeCollection` con `validateKnowledgeCollection`
4. construye `InsightRuntimeRequest`
5. delega a `runtime.execute`
6. propaga la respuesta del Runtime como `success` o `runtime-failure`
7. ante fallo controlable retorna `adapter-failure` fail-closed

## Fail-Closed

Codigos de fallo del Adapter:

- `ADAPTER_INVALID_INPUT`
- `ADAPTER_MISSING_DEPENDENCY`
- `ADAPTER_INCOMPATIBLE_SOURCE_DATA`
- `ADAPTER_KNOWLEDGE_BUILD_FAILED`
- `ADAPTER_KNOWLEDGE_VALIDATION_FAILED`
- `ADAPTER_RUNTIME_INVOCATION_FAILED`
- `ADAPTER_RUNTIME_INVALID_RESPONSE`

Politica:

- no excepciones como API publica
- sin exito parcial
- respuesta determinista y explicita
- sin mutaciones externas

## Suite Unitaria 7A

Cobertura incluida:

- adaptacion correcta de KnowledgeCollection
- delegacion al Runtime
- propagacion correcta de respuestas
- preservacion fail-closed
- coleccion vacia de insights
- datos incompatibles
- determinismo
- aislamiento respecto al Runtime

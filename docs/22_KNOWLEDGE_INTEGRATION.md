# 22. Knowledge Integration

## Proposito

Milestone 7C formaliza la frontera determinista entre Knowledge Layer y Runtime Adapter.

La integracion recibe una `KnowledgeCollection` validada, valida la compatibilidad minima de frontera, la adapta al contrato de ejecucion esperado por el Runtime Adapter y delega una sola vez.

## Alcance De 7C

Implementado:

- `createKnowledgeIntegration` como frontera de aplicacion
- contratos publicos de request/result/failure/traceability
- validacion minima de request, protocolo y versiones
- delegacion unica a Runtime Adapter por puerto inyectable
- validacion de coherencia de respuesta del Runtime Adapter
- preservacion de trazabilidad `KnowledgeCollection -> Runtime`
- fail-closed con codigos estables y sin excepciones como API publica

No implementado en 7C:

- reconstruccion de `KnowledgeCollection`
- ejecucion directa de `InsightRuntime`
- acceso a Builder, Validator, Orchestrator o Repository
- acceso a Dexie/IndexedDB
- persistencia
- UI/React
- IA/LLM

## Arquitectura

Knowledge Layer

-> Knowledge Integration

-> Runtime Adapter

-> Insight Runtime

## Contratos Nuevos

- `src/services/knowledgeIntegrationInterfaces.ts`
- `src/services/knowledgeIntegrationResult.ts`
- `src/services/knowledgeIntegration.ts`

## Flujo

1. valida request de integracion
2. valida estructura minima de `KnowledgeCollection`
3. valida compatibilidad de protocolo y versiones
4. construye request readonly para Runtime Adapter
5. delega exactamente una vez a Runtime Adapter
6. valida consistencia de respuesta y trazabilidad
7. retorna `success` o `failure` determinista

## Fail-Closed

Codigos de fallo estables:

- `KNOWLEDGE_INTEGRATION_INVALID_REQUEST`
- `KNOWLEDGE_INTEGRATION_INVALID_COLLECTION`
- `KNOWLEDGE_INTEGRATION_PROTOCOL_INCOMPATIBLE`
- `KNOWLEDGE_INTEGRATION_VERSION_INCOMPATIBLE`
- `KNOWLEDGE_INTEGRATION_MISSING_DEPENDENCY`
- `KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE`
- `KNOWLEDGE_INTEGRATION_INCONSISTENT_RESPONSE`
- `KNOWLEDGE_INTEGRATION_TRACEABILITY_INCONSISTENT`

## Trazabilidad

La salida exitosa preserva:

- `integrationId`
- `knowledgeCollectionId`
- referencia al snapshot origen (`sourceSnapshotId`, `sourceSnapshotKey`, `sourceSnapshotRevision`)
- versiones de `KnowledgeCollection`
- `executionId` y `protocolVersion` de runtime
- checks deterministas de relacion request/adapter/runtime

## Suite Unitaria 7C

Cobertura incluida:

- integracion exitosa
- delegacion unica al Runtime Adapter
- coleccion valida no mutada
- coleccion vacia
- request invalido
- protocolo incompatible
- version incompatible
- dependencia ausente
- excepcion controlable
- respuesta inconsistente
- fail-closed
- determinismo
- preservacion de trazabilidad
- ausencia de acceso a Runtime interno
- ausencia de acceso a Builder
- ausencia de acceso a Validator
- ausencia de acceso a Repository

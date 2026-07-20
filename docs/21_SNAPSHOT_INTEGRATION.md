# 21. Snapshot Integration

## Proposito

Milestone 7B formaliza la frontera determinista entre FinancialSnapshot canonico y Knowledge Layer.

La integracion recibe un snapshot sellado, valida compatibilidad minima de frontera, delega construccion de conocimiento a la API publica de Knowledge Layer y devuelve un resultado explicito fail-closed.

## Alcance De 7B

Implementado:

- `createSnapshotKnowledgeIntegration` como frontera de integracion
- contratos publicos de request/result/failure/traceability
- validaciones minimas de frontera para snapshot y versiones
- delegacion unica a un puerto de Knowledge Layer
- validacion de coherencia de respuesta y trazabilidad
- resultado determinista JSON-safe sin excepciones como API publica

No implementado en 7B:

- acceso a Dexie/IndexedDB
- reconstruccion de snapshot
- recalculo de metricas financieras
- ejecucion de Runtime Adapter
- ejecucion de InsightRuntime
- persistencia
- UI/React
- IA/LLM

## Arquitectura

FinancialSnapshot canonico

-> SnapshotKnowledgeIntegration

-> Knowledge Layer publica

-> KnowledgeCollection

## Contratos Nuevos

- `src/services/snapshotKnowledgeIntegrationInterfaces.ts`
- `src/services/snapshotKnowledgeIntegrationResult.ts`
- `src/services/snapshotKnowledgeIntegration.ts`

## Flujo Operativo

1. valida request de integracion (`integrationId`, `snapshot`, `versions`)
2. valida compatibilidad minima del snapshot (`status`, identidad, version, protocolo, metadatos estructurales)
3. invoca una sola vez `knowledgeLayer.buildValidatedCollection(...)`
4. valida coherencia de `KnowledgeCollection` retornada
5. valida trazabilidad snapshot -> knowledge
6. retorna success o failure con codigo estable

## Fail-Closed

Codigos de fallo estables:

- `INTEGRATION_INVALID_REQUEST`
- `INTEGRATION_INVALID_SNAPSHOT`
- `INTEGRATION_SNAPSHOT_VERSION_INCOMPATIBLE`
- `INTEGRATION_PROTOCOL_UNSUPPORTED`
- `INTEGRATION_MISSING_DEPENDENCY`
- `INTEGRATION_KNOWLEDGE_LAYER_FAILURE`
- `INTEGRATION_KNOWLEDGE_LAYER_INVALID_RESPONSE`
- `INTEGRATION_KNOWLEDGE_COLLECTION_INCONSISTENT`
- `INTEGRATION_TRACEABILITY_INCONSISTENT`

Ante fallo:

- no hay exito parcial
- no se fabrica `KnowledgeCollection`
- no se reintenta
- no se muta la entrada
- se preserva motivo tecnico en estructura JSON-safe

## Trazabilidad

`SnapshotKnowledgeTraceability` incluye:

- `integrationId`
- `snapshotId`, `snapshotKey`, `snapshotRevision`
- `snapshotVersion`, `canonicalizationVersion`
- `knowledgeCollectionId`
- versiones de Knowledge (`knowledgeVersion`, `builderVersion`, `rulesVersion`, `projectionVersion`)
- relacion determinista entre snapshot de entrada y coleccion resultante

## Suite Unitaria 7B

Cobertura incluida:

- integracion exitosa
- delegacion unica a Knowledge Layer
- snapshot no mutado
- respuesta determinista
- request invalido / snapshot nulo / snapshot invalido
- version incompatible y protocolo no soportado
- dependencia ausente
- excepcion controlable
- respuesta nula de dependencia
- knowledge collection inconsistente
- traceability correcta e inconsistente
- dataset vacio valido del snapshot
- fail-closed
- misma entrada -> misma salida
- ausencia de Date.now, UUID aleatorio y valores ambientales
- no acceso a Dexie ni IndexedDB
- no ejecucion de InsightRuntime
- no duplicacion de logica financiera ni de Knowledge Layer

# 14. Insight Engine Architecture

## 1. Proposito

Milestone 6A establece la base contractual del Insight Engine para Private Balance.
Esta fase crea solamente tipos TypeScript deterministas, serializables, local-first y fail-closed.

No implementa generacion de insights, reglas financieras, validadores runtime, builders, repositorios, consumidores visibles, IA o LLM.

## 2. Posicion En La Arquitectura

Pipeline aprobado:

Dexie -> Financial Engine -> Financial Snapshot -> Knowledge Layer -> Insight Engine -> LLM Assistant (futuro)

Insight Engine se define como primer consumidor formal del Knowledge Layer.
En 6A no existe consumo runtime; solo contratos pasivos.

## 3. Dependencias Permitidas

Insight Layer puede depender de:

- Tipos publicos del Knowledge Layer.
- Tipos compartidos de scope/tiempo/currency.
- Utilidades type-only estrictamente necesarias.

En 6A se reutilizan especificamente:

- `KnowledgeSnapshotId`
- `KnowledgeSnapshotKey`
- `KnowledgeRevision`
- `KnowledgeFactId`
- `CurrencyCode`
- `IanaTimeZone`
- `UtcInstant`

## 4. Dependencias Prohibidas

Insight Layer no puede depender de:

- Dexie.
- repositories.
- services.
- UI.
- Home.
- Reports.
- browser APIs.
- WebCrypto.
- feature flags.
- n8n.
- Neon.
- WhatsApp.
- OpenAI.
- LLM providers.

## 5. Vocabulario Del Dominio

Vocabulario inicial:

- `InsightId`: identificador determinista futuro derivado de preimagen estable.
- `Insight`: unidad contractual de insight determinista.
- `InsightCollection`: conjunto contractual de insights para un scope.
- `InsightCategory`: catalogo cerrado inicial.
- `InsightSeverity`: criticidad contractual cerrada.
- `InsightStatus`: estado contractual del ciclo de vida.
- `InsightConfidenceScore`: entero normalizado entre 0 y 100.
- `InsightEvidence`: referencia trazable a Knowledge facts/snapshot.
- `InsightScope`: contexto temporal y financiero del insight.
- `InsightProtocolVersion`: version de protocolo independiente de reglas.

## 6. Contrato De Insight

Contrato publico definido en `src/types/insightLayer.ts`:

- `insightId`
- `protocolVersion`
- `category`
- `severity`
- `confidence`
- `status`
- `titleCode`
- `messageCode`
- `rule`
- `source`
- `scope`
- `evidence`
- `parameters`
- `supersedesInsightIds`
- `traceability`

Reglas del contrato:

- Solo campos `readonly`.
- Sin funciones, clases ni simbolos en payload serializable.
- Sin `Date`, `Map`, `Set`.
- Sin `any`.
- `titleCode` y `messageCode` son codigos deterministas, no textos finales localizados.
- `parameters` usa JSON-safe estricto (`InsightJsonObject`).

## 7. Contrato De InsightCollection

Contrato publico definido en `src/types/insightLayer.ts`:

- `collectionId`
- `protocolVersion`
- `source`
- `sourceKnowledgeSnapshotId`
- `sourceKnowledgeSnapshotKey`
- `sourceKnowledgeRevision`
- `scope`
- `collectionRevision`
- `insights`
- `supersedesCollectionId`
- `traceability`
- `compatibility`

La coleccion permite representar tanto origen `knowledge` como `none`, con referencias explicitas nullable cuando no existe fuente de conocimiento.

## 8. Identidad Determinista Futura

En 6A no se implementa funcion de derivacion de identidad.
Se documenta preimagen normativa para milestones posteriores:

- `protocolVersion`
- `ruleId`
- `ruleVersion`
- `category`
- `scope`
- evidencia semantica relevante
- `parameters` normalizados

Campos explicitamente excluidos de la identidad:

- `generatedAt`
- `evaluatedAt`
- `sealedAt`
- `persistedAt`
- posicion accidental del array
- UUID aleatorio
- `Math.random`

## 9. Trazabilidad

El contrato debe responder en fases futuras:

- Que Knowledge Snapshot produjo el insight.
- Que facts respaldan el insight.
- Que regla lo genero y con que version.
- Que scope financiero representa.
- Que insight previo supersede.
- Por que su identidad es determinista.

Esto se modela con:

- `InsightEvidence`
- `InsightRuleReference`
- `InsightTraceabilityMetadata`
- referencias `sourceKnowledge*` en `InsightCollection`

## 10. Fail-Closed

6A define contratos para soportar rechazo determinista posterior de:

- categorias desconocidas
- severidades desconocidas
- estados desconocidos
- source fuera de `knowledge|none`
- versiones incompatibles
- confidence fuera de 0..100
- evidencia vacia
- `factIds` duplicados
- scope inconsistente
- revision invalida
- supersedes incoherente
- IDs no deterministas
- parametros no serializables

Estas invariantes se documentan en tipos y catalogos cerrados; el validador runtime queda fuera de 6A.

## 11. Versionado

Versionado inicial explicitamente separado:

- `INSIGHT_PROTOCOL_VERSION = 1`
- `InsightProtocolVersion` como tipo derivado de constante
- `InsightRuleReference` desacopla `ruleVersion` de `protocolVersion`

## 12. Relacion Con Knowledge Layer

Insight Layer en 6A es compatible con Knowledge por contrato, no por runtime:

- Reutiliza IDs y revision de Knowledge.
- Requiere evidencia fuente `knowledge` para `InsightEvidence`.
- Declara compatibilidad explicita mediante `InsightKnowledgeCompatibility`.

No se consume Knowledge Snapshot en ejecucion en este milestone.

## 13. Relacion Futura Con LLM

La relacion con LLM Assistant es diferida.
En 6A no existen prompts, proveedores LLM, recomendaciones automaticas ni narrativa generada.

LLM quedara como consumidor futuro de resultados ya deterministas del Insight Engine.

## 14. Fuera De Alcance En 6A

Expresamente fuera de alcance:

- Insight Rules Catalog ejecutable.
- Insight Builder runtime.
- Insight Validator runtime.
- canonicalizacion, fingerprint o sealer de insight.
- persistencia de insight.
- shadow mode de insight.
- promotion policy/executor.
- integracion en Home o Reports.
- UI visible.
- IA o LLM.

## 15. Roadmap Inicial 6A-6J (Propuesta)

- 6A Foundation
- 6B Insight Rules Catalog
- 6C Insight Builder
- 6D Insight Validator
- 6E Insight Canonicalization
- 6F Insight Fingerprint
- 6G Insight Sealer
- 6H Insight Repository
- 6I Insight Shadow Mode
- 6J Insight Promotion Policy/Executor

Este roadmap es informativo y no implica implementacion en 6A.
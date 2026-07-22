# 17. Insight Validator

## Proposito

Milestone 6D incorpora el componente de certificacion del Insight Engine.

El Validator verifica que una `InsightCollection` sea estructuralmente valida y consistente con el catalogo de reglas, sin construir ni modificar insights.

## Alcance De 6D

Implementado:

- `validateInsightCollection` como funcion pura y determinista
- contratos `ValidationIssue` y `ValidationReport`
- validaciones fail-closed sobre estructura, referencias y consistencia interna
- deteccion de duplicados e incompatibilidades de version
- validacion de evidence, confidence, category, severity, status y scope trazable

No implementado en 6D:

- construccion de insights
- correccion automatica de datos
- ejecucion de reglas
- persistencia
- repository
- runtime scheduler
- dependencias IA/LLM

## Arquitectura En Pipeline

KnowledgeCollection

-> InsightRule

-> InsightBuilder

-> InsightValidator

-> InsightCollection certificada

## Contratos Nuevos

- `src/insight/validationIssue.ts`
- `src/insight/validationReport.ts`
- `src/insight/insightValidator.ts`

## Criterios De Validacion

El Validator certifica, de manera determinista:

- estructura minima de `InsightCollection`
- IDs unicos (`insightId`, referencias y fact IDs)
- evidence valida (tipos, required/matched/missing facts, trazabilidad)
- confidence valida (modo, unidad, rango)
- referencia de regla existente en catalogo
- compatibilidad de versiones (protocolo y bounds declarados)
- categorias y severities permitidas
- status permitidos de ejecucion
- scope coherente entre collection, traceability y matchedFacts
- consistencia interna insight <-> rule <-> execution

## Modelo De Fallo

- Nunca lanza excepciones por datos invalidos.
- Toda condicion invalida se materializa como `ValidationIssue`.
- Si existe al menos un issue, el `ValidationReport` es `invalid`.
- Se agrega marcador explicito `INSIGHT_VALIDATION_FAIL_CLOSED` para bloquear certificacion.

## Determinismo

El reporte es deterministicamente reproducible:

- sin IO ni side effects
- sin timestamps ni random
- deduplicacion estable de issues
- orden lexicografico estable por `code`, `path`, `message`

## Suite Unitaria 6D

Cobertura minima incluida:

- coleccion valida
- coleccion vacia
- ids duplicados
- evidence invalida
- confidence fuera de rango
- regla inexistente
- incompatibilidad de versiones
- status invalido
- severity invalida
- categoria invalida
- fail-closed
- determinismo

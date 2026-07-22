# 16. Insight Builder

## Proposito

Milestone 6C implementa el primer runtime del Insight Engine.

Esta fase transforma una `KnowledgeCollection` validada en una `InsightCollection` por medio de reglas declarativas (`InsightRuleDescriptor`) del milestone 6B.

## Alcance De 6C

Implementado:

- componente `buildInsightCollection` puro y determinista
- contratos de salida de `InsightCollection`, `Insight`, `InsightEvidence` y trazabilidad
- interfaces inyectables para habilitacion de reglas y resolucion de confidence derivado
- evaluacion de compatibilidad Knowledge x Rule antes de ejecutar cada regla
- ejecucion de solo reglas habilitadas
- comportamiento fail-closed por regla

No implementado en 6C:

- Validator de catalogo/reglas (milestone 6D)
- Repository
- Scheduler
- persistencia
- IO
- acceso a IndexedDB
- dependencias de IA/LLM
- UI

## Arquitectura

KnowledgeCollection

-> InsightRuleDescriptor[]

-> InsightBuilder

-> InsightCollection

### Flujo determinista

1. Orden estable de reglas por `ruleId`, `ruleVersion`, `protocolVersion`.
2. Validacion estructural minima de entrada (`state=validated`, `factCount`, IDs unicos).
3. Filtro de habilitacion de regla (`lifecycle.active` + policy inyectable).
4. Checks de compatibilidad:

- protocolo
- metadata determinista
- versiones de Knowledge
- revision minima
- snapshot key mode
- matching de facts
- required facts de evidence
- scope/currency/timezone
- categoria de salida compatible

5. Construccion de evidence con referencias directas a facts Knowledge.
6. Calculo de confidence:

- `fixed-score`: score fijo
- `bounded-score`: promedio determinista `(min+max)/2`
- `evidence-derived`: resolver inyectado

7. Emision de `Insight` con trazabilidad completa:

Knowledge fact IDs -> Rule reference -> Evidence -> Insight ID

## Contratos Nuevos

- `src/insight/interfaces.ts`
- `src/insight/types.ts`
- `src/insight/insightBuilder.ts`

## Invariantes

- puro (sin mutaciones de entrada)
- determinista (misma entrada y mismas dependencias => misma salida)
- fail-closed (si una regla no es segura/compatible, no produce insight)
- sin side effects
- sin singletons
- dependencias externas solo por interfaces

## Suite Unitaria 6C

Cobertura minima incluida:

- ejecucion de una regla
- ejecucion de multiples reglas
- regla deshabilitada
- compatibilidad de entrada
- evidence correcta
- confidence (fixed, bounded, evidence-derived)
- determinismo
- coleccion vacia
- reglas vacias
- fail-closed

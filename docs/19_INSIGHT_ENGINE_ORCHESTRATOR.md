# 19. Insight Engine Orchestrator

## Proposito

Milestone 6F implementa el Application Service del dominio Insight Engine para coordinar el pipeline completo de forma determinista y fail-closed.

El Orchestrator no construye reglas, no valida directamente y no conoce persistencia.

## Alcance De 6F

Implementado:

- recepcion de `KnowledgeCollection` y `InsightRuleDescriptor[]`
- invocacion de `InsightBuilder`
- recepcion de `InsightCollection`
- invocacion de `InsightValidator`
- actualizacion de `InsightRepository` solo cuando el `ValidationReport` es valido
- rechazo fail-closed cuando la validacion es invalida o rompe invariantes
- resultado determinista con estado del pipeline

No implementado en 6F:

- Runtime
- Scheduler
- persistencia
- IndexedDB
- Dexie
- UI
- React
- IA/LLM
- generacion de lenguaje natural
- mutacion de Knowledge

## Arquitectura

KnowledgeCollection

-> InsightBuilder

-> InsightValidator

-> InsightRepository

-> InsightCollection

## Contratos Nuevos

- `src/insight/engineInterfaces.ts`
- `src/insight/engineResult.ts`
- `src/insight/insightEngine.ts`

## Principios Aplicados

- toda dependencia inyectada por interfaz
- sin singletons
- sin estado global
- sin observables
- sin eventos
- sin asincronia innecesaria
- determinismo end-to-end
- fail-closed estricto

## Modelo Operativo

`createInsightEngine` construye el orquestador con puertos inyectables:

- `InsightEngineBuilderPort`
- `InsightEngineValidatorPort`

`run` ejecuta el pipeline:

1. Builder recibe `knowledgeCollection` y `rules`.
2. Validator certifica la `InsightCollection` construida.
3. Si el reporte es valido, el repositorio se reemplaza.
4. Si es invalido, el repositorio no cambia.
5. El resultado retorna estado, coleccion, assessment y `ValidationReport`.

Politica fail-closed:

- nunca promueve colecciones sin invariantes `deterministicOutput=true` y `failClosed=true`
- ante excepcion de pipeline devuelve resultado rechazado sin actualizar repositorio

## Suite Unitaria 6F

Cobertura minima incluida:

- pipeline exitoso
- validator invalido
- repository actualizado
- repository no actualizado
- builder invocado una sola vez
- validator invocado una sola vez
- repository invocado unicamente cuando corresponde
- determinismo
- fail-closed
- coleccion vacia
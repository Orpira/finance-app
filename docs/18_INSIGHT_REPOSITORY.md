# 18. Insight Repository

## Proposito

Milestone 6E implementa el repositorio de dominio del Insight Engine como componente en memoria, puro, determinista y fail-closed.

El Repository administra una `InsightCollection` para consultas de dominio, sin construir ni validar insights.

## Alcance De 6E

Implementado:

- `replace(collection)`
- `getAll()`
- `getById()`
- `exists()`
- `count()`
- `clear()`
- `getByCategory()`
- `getBySeverity()`
- `getByStatus()`
- `getByScope()`
- `getByRule()`
- `filterByConfidence()`
- `getStatistics()`

No implementado en 6E:

- persistencia
- IndexedDB
- cache
- eventos
- sincronizacion
- UI
- IA/LLM
- ejecucion o validacion de reglas

## Arquitectura

InsightCollection

-> InsightRepository

-> Consultas deterministas

## Contratos Nuevos

- `src/insight/repositoryInterfaces.ts`
- `src/insight/insightRepository.ts`
- `src/insight/repositoryStatistics.ts`

## Principios Aplicados

- funciones puras sin estado global
- sin singleton mutable
- sin dependencias de infraestructura
- inmutabilidad observable: el repositorio retorna copias independientes
- determinismo: mismas entradas, mismas salidas
- complejidad lineal: cada operacion procesa la coleccion en O(n) como maximo

## Modelo Operativo

El repositorio se crea en memoria con `createInsightRepository(collection?)`.

Las operaciones no mutan estado global:

- `replace(collection)` retorna un nuevo repositorio con la coleccion reemplazada
- `clear()` retorna un nuevo repositorio vacio
- las consultas (`get*`, `filterByConfidence`, `exists`, `count`) son lecturas deterministas

Fail-closed:

- si la coleccion recibida no declara `deterministicOutput=true` y `failClosed=true`, el repositorio se comporta como vacio
- filtros invalidos de confidence (`minimumScore > maximumScore`) retornan `[]`

## Estadisticas Deterministas

`getStatistics()` calcula siempre desde la coleccion actual (sin cache):

- total de insights
- total por categoria
- total por severity
- total por status de ejecucion
- total por scope (clave compuesta de trazabilidad)
- confidence promedio
- confidence minima
- confidence maxima

## Suite Unitaria 6E

Cobertura minima incluida:

- coleccion vacia
- replace
- clear
- getAll
- getById
- exists
- count
- getByCategory
- getBySeverity
- getByStatus
- getByScope
- getByRule
- filterByConfidence
- statistics
- determinismo
- fail-closed

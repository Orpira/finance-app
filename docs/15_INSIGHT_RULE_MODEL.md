# 15. Insight Rule Model

## Proposito

Milestone 6B define el modelo declarativo de una regla del Insight Engine.
Esta fase no implementa runtime, evaluadores, builders, validadores, repositorios ni persistencia.

El objetivo es describir una regla como contrato estable, serializable y versionado para los milestones siguientes.

## Filosofia Declarativa

Una regla en 6B no ejecuta comportamiento.
Solo declara:

- identidad determinista
- dependencias requeridas
- salida esperada por codigos
- evidencia requerida
- compatibilidad y ciclo de vida
- parametros serializables

No hay evaluacion de condiciones, no hay lectura de snapshots, no hay calculo de confianza y no hay generacion de insights.

## Identidad

Cada regla se identifica por una referencia determinista:

- ruleId
- ruleVersion
- protocolVersion

La identidad no puede depender de UUID, random ni timestamps.

## Versionado

El modelo publica una version inicial:

- INSIGHT_RULE_PROTOCOL_VERSION = 1

Y separa:

- version de protocolo de reglas
- version del descriptor de una regla
- version del catalogo

## Compatibilidad

Cada regla declara compatibilidad explicita:

- minimumProtocol
- maximumProtocol
- deprecated
- replacementRule
- breakingChanges
- supportedKnowledgeVersion

Esto permite politicas fail-closed en milestones posteriores sin ejecutar logica en 6B.

## Dependencias Declaradas

Cada regla declara de forma explicita:

- sourceLayer = knowledge-layer
- tipos de snapshot compatibles
- versiones de Knowledge compatibles
- facts requeridos
- politica de matching de facts
- scope requerido
- categorias de insight compatibles

No se permiten dependencias implicitas.

## Metadata

El modelo incluye metadata contractual para gobernanza:

- ownerTeam
- tags
- domain
- deterministicIdentity
- deterministicOutput
- localFirst
- failClosed

## Evidencia

La regla declara evidencia que debera construirse despues:

- evidenceType
- summaryCode
- requiredFacts
- source
- traceabilityRequired

No construye evidencia en 6B.

## Ciclo De Vida De Regla

El ciclo de vida es declarativo:

- draft
- active
- deprecated
- retired

Tambien se declaran:

- introducedInProtocol
- deprecatedInProtocol
- retiredInProtocol

## Relacion Con 6A

Milestone 6A define contratos de Insight.
Milestone 6B define contratos de Rule que describen como una regla debera producir esos artifacts en futuras fases, sin ejecutarlos.

## Relacion Con Builder (6C)

En 6C, el Builder leera el descriptor de regla y aplicara runtime.
En 6B no existe Builder; solo contrato de entrada, salida, evidencia y parametros.

## Relacion Con Validator (6D)

En 6D, el Validator verificara invariantes sobre catalogo y reglas.
En 6B solo se publica el conjunto de invariantes fail-closed declarados.

## Invariantes Fail-Closed Preparados

El catalogo queda preparado para rechazar en futuras fases:

- duplicate-rule-identity
- incompatible-protocol-version
- unknown-rule-category
- missing-dependency-contract
- missing-message-code
- missing-title-code
- invalid-confidence-policy
- incompatible-facts-contract

## Ejemplos Conceptuales

Un descriptor de regla debera contener al menos:

- reference
- input
- output
- evidence
- metadata
- compatibility
- lifecycle

Todos los campos son readonly y JSON-safe.
No hay funciones ni clases.
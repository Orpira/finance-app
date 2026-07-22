# 30 - Provider Adapter Compliance Suite (Milestone 8E)

## 1) Proposito

Milestone 8E implementa un harness provider-neutral para certificar que cualquier adaptador LLM futuro cumple los contratos 8A, 8B, 8C y 8D antes de ser aceptado.

8E no implementa proveedores reales, no ejecuta IA y no realiza llamadas de red.

## 2) Arquitectura del harness

```text
AdapterFixture
  -> AdapterComplianceSuite
  -> AdapterContractVerifier
  -> AdapterCompliancePort
  -> AdapterComplianceReport (success/failure)
```

Componentes principales:

- contratos: src/intelligence/ai-foundation/providerComplianceSuiteContracts.ts
- implementacion determinista: src/intelligence/ai-foundation/providerComplianceSuite.ts

## 3) Criterios de conformidad

La suite valida reglas mandatorias:

- respeto de autorizacion por AIPrivacyBoundary;
- aceptacion exclusiva de AIContextPackage;
- implementacion de LLMAdapterPort;
- declaracion de capacidades coherente;
- cumplimiento fail-closed;
- validez estructural de resultados contractuales;
- compatibilidad de protocolo;
- compatibilidad de version de proveedor.

Si cualquier regla falla, el resultado global es `failure`.

## 4) Validaciones obligatorias

El port de compliance aplica validaciones deterministas y sin fallback silencioso:

- parse estricto de fixture y escenarios;
- canonicalizacion de reglas/codigos;
- reporte readonly y JSON-safe;
- rechazo de escenarios invalidos;
- rechazo de resultados contractuales inconsistentes.

El reporte produce:

- `AdapterValidationResult[]` por regla;
- `AdapterComplianceFailure[]` con codigo explicito;
- resumen de reglas aprobadas/rechazadas.

## 5) Integracion futura con proveedores reales

8E no integra proveedores. La extension futura consiste en proveer `AdapterFixture` por cada adaptador concreto y ejecutar la suite antes de registro en runtime.

Flujo previsto:

1. construir fixture del adaptador;
2. ejecutar suite 8E;
3. aceptar adaptador solo con reporte `success`;
4. rechazar cualquier adaptador con failure contractual.

## 6) Estrategia de certificacion de adaptadores

Cada candidato debe demostrar:

- compatibilidad contractual completa con 8A-8D;
- determinismo de resultados para mismo input;
- metadatos `deterministic: true` y `failClosed: true`;
- ausencia de red, SDKs, interfaces conversacionales y persistencia.

Certificacion:

- bloqueante por cualquier `AdapterComplianceFailure`;
- sin aceptacion parcial;
- sin degradacion de validaciones.

# 29 - Provider Capability Registry (Milestone 8D)

## 1) Proposito

Milestone 8D implementa una capa provider-neutral para describir capacidades declarativas de futuros adaptadores LLM y resolver seleccion de adapter de forma determinista.

8D no implementa adaptadores reales, no implementa proveedores concretos y no ejecuta invocaciones de red.

## 2) Arquitectura

```text
AdapterResolutionRequest
        -> LLMProviderRegistry (declarativo)
        -> LLMCapabilityResolver (determinista)
           -> Compatibility Evaluation
           -> Canonical Ordering
        -> AdapterResolutionResult (success/failure)
```

Componentes principales:

- contratos: src/intelligence/ai-foundation/providerCapabilityRegistryContracts.ts
- implementacion determinista: src/intelligence/ai-foundation/providerCapabilityRegistry.ts

## 3) Registry

`LLMProviderRegistry` define:

- identidad y version del registry;
- protocolo soportado por la capa de resolucion;
- listado readonly de `LLMProviderDescriptor`;
- `AdapterSelectionPolicy` fail-closed y determinista.

El registry se canonicaliza por orden estable de provider (`providerId`, `providerVersion`).

## 4) Capability Model

`LLMCapabilitySet` modela solo capacidades declarativas.

Capacidades declaradas en 8D:

- `TEXT_GENERATION`
- `STRUCTURED_OUTPUT`
- `FUNCTION_CALLING`
- `STREAMING`
- `LOCAL_EXECUTION`
- `EXTERNAL_EXECUTION`
- `MULTIMODAL_INPUT`
- `MULTIMODAL_OUTPUT`
- `TOKEN_ACCOUNTING_SUPPORTED`

8D no implementa ninguna de estas capacidades. Solo las describe para compatibilidad contractual.

## 5) Resolver

`LLMCapabilityResolver` recibe:

- proposito (`purpose`)
- modo de ejecucion (`executionMode`)
- version de protocolo
- capacidades requeridas
- version requerida de proveedor (opcional)

Y devuelve:

- `AdapterResolutionSuccess` con descriptor compatible
- o `AdapterResolutionFailure` fail-closed

Reglas clave:

- sin fallback silencioso;
- seleccion determinista por orden canonico;
- rechazo explicito cuando no existe provider compatible.

## 6) Compatibilidad

`ProviderCompatibility` + `CapabilityValidationResult` evalua por proveedor:

- compatibilidad de protocolo;
- compatibilidad de modo de ejecucion;
- compatibilidad de version;
- compatibilidad de proposito;
- capacidades faltantes.

Si no hay coincidencia valida, el resultado es failure con codigo explicito:

- `NO_CAPABILITY_MATCH`
- `PROVIDER_INCOMPATIBLE`
- `VERSION_INCOMPATIBLE`
- `PROTOCOL_INCOMPATIBLE`
- `EXECUTION_MODE_INCOMPATIBLE`

## 7) Limitaciones

8D no incluye:

- adaptadores concretos;
- proveedores concretos;
- HTTP/fetch/axios;
- SDKs o API keys;
- prompt engineering o chat;
- streaming real;
- persistencia;
- UI/React.

## 8) Integracion futura con 8E

8D prepara la base para que 8E conecte la resolucion contractual con la frontera de invocacion del adapter, manteniendo:

- independencia del dominio financiero;
- neutralidad de proveedor;
- compatibilidad protocol/version;
- fail-closed determinista.

8E podra consumir el descriptor seleccionado por 8D sin modificar contratos certificados previos.

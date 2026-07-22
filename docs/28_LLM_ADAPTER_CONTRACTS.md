# 28 - LLM Adapter Contracts (Milestone 8C)

## 1) Proposito

Milestone 8C define exclusivamente la capa contractual para una futura integracion de proveedores LLM.

8C no implementa proveedor concreto ni transporte.

Su alcance es:

- estandarizar request/response/resultado del adapter;
- fijar protocolo y versionado de contrato;
- declarar capacidades compatibles;
- exigir trazabilidad de invocacion;
- imponer comportamiento fail-closed a nivel de frontera.

## 2) Arquitectura

```text
AI Context Package (8B)
        -> LLM Adapter Port (8C contracts)
           -> Contract Validation
           -> Capability Compatibility Check
           -> Protocol/Version Compatibility Check
        -> LLM Invocation Result (success/failure)
```

Componente contractual principal:

- `src/intelligence/ai-foundation/llmAdapterContracts.ts`

## 3) Separacion Del Dominio

La entrada permitida para 8C es solamente `AIContextPackage`.

El contrato no acepta ni requiere:

- Financial Snapshot;
- Knowledge Collection;
- Insight Runtime interno.

La serializacion contractual usa tipos JSON neutrales locales del adapter.

No existe dependencia con tipos del dominio financiero para modelar payloads LLM.

Esto evita acoplar la frontera de IA al modelo de dominio financiero interno.

## 4) Provider Neutrality

8C no contiene:

- implementaciones de proveedor;
- SDKs de proveedor;
- transporte de red;
- claves de API;
- semantica de prompt/chat/streaming/tool-calling;
- persistencia local.

Los proveedores se describen de manera abstracta con `LLMProviderDescriptor` + `LLMCapabilities`.

## 5) Protocolo

`LLMProtocolVersion` y `LLM_PROTOCOL_VERSIONS` definen la compatibilidad contractual esperada.

El contrato obliga a validar:

- version del request;
- version declarada por proveedor;
- compatibilidad request/proveedor para protocolo.

Incompatibilidades deben resolverse en fallo fail-closed.

## 6) Versionado

El contrato separa tres ejes:

- version de protocolo de adapter (`LLMProtocolVersion`);
- version del proveedor (`providerVersion`);
- version de policy/contexto heredada desde `AIContextPackage` en trazabilidad.

Ausencias o inconsistencias de version deben terminar en failure code.

## 7) Capacidades

`LLMCapabilities` define:

- protocolos soportados;
- modos de ejecucion soportados;
- flags de capacidad declarativa;
- limites maximos de tokens;
- garantias de determinismo contractual.

`LLMRequest` puede declarar `requiredCapabilityFlags` para enforcement de compatibilidad.

## 8) Fail-Closed

`LLMInvocationResult` es union discriminada con:

- `ok: true` para exito contractual;
- `ok: false` para rechazo.

`LLMFailureCode` cubre rechazos por:

- request invalido;
- contexto ausente;
- protocolo ausente/no soportado;
- proveedor/version/capacidades ausentes;
- incompatibilidad de capacidades o modo;
- budget de tokens invalido;
- inconsistencia de resultado.

En particular, si falta alguno de estos elementos la salida contractual debe ser `failure`:

- contexto;
- protocolo;
- version;
- capacidades;
- compatibilidad.

Nunca se exponen excepciones publicas como API de frontera.

## 8.1) Contrato JSON-Safe y Readonly

Todos los contratos del milestone son readonly y serializables a JSON.

No se permiten clases, prototipos mutables ni valores no serializables.

## 9) Determinismo

8C evita en su capa contractual:

- `Date.now()`
- `new Date()`
- `Math.random()`
- `crypto.randomUUID()`

La evaluacion de compatibilidad debe ser puramente declarativa y reproducible.

## 10) Limitaciones Del Milestone

8C no incluye:

- invocacion real de modelos;
- red ni transporte;
- adaptadores de proveedor;
- rendering de UI;
- persistencia local.

Por diseno, 8C prepara una frontera estable para implementar adaptadores reales en milestones posteriores sin romper el dominio.

## 11) Compatibilidad Futura

La estructura permite agregar proveedores sin modificar contratos de 8A/8B:

- manteniendo `AIContextPackage` como unica entrada;
- agregando implementaciones concretas detras de `LLMAdapterPort`;
- conservando failure codes y trazabilidad como contrato estable.

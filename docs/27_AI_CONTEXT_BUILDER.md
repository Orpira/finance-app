# 27 - AI Context Builder (Milestone 8B)

## 1) Proposito

Milestone 8B implementa el Authorized Context Builder de Private Balance.

Su responsabilidad es exclusiva:

- recibir un envelope autorizado por 8A;
- resolver descriptores autorizados;
- aplicar redaccion declarativa;
- aplicar minimizacion determinista;
- emitir un AI Context Package provider-neutral.

8B no ejecuta IA ni prepara texto de interaccion.

## 2) Arquitectura

```text
AIAuthorizedRequestEnvelope + SourceDescriptors
        -> Validation
        -> Source Resolution
        -> Redaction
        -> Minimization
        -> Canonical Ordering
        -> AIContextPackage
```

Componentes principales:

- contratos de contexto: `aiContextBuilderContracts.ts`;
- puerto del builder: `aiContextBuilderInterfaces.ts`;
- builder fail-closed: `aiContextBuilder.ts`.

## 3) Entrada y Salida

### Entrada

- `AIAuthorizedRequestEnvelope` (emitido por 8A).
- `sourceDescriptors` tipados por categoria autorizada.

### Salida

- `AIContextBuildResult` discriminado.
- En exito: `AIContextPackage`.
- En rechazo: failure fail-closed sin package parcial.

## 4) Source Descriptors

8B opera solo sobre descriptores declarativos:

- `InsightSummaryReference`
- `InsightReadModelReference`
- `SnapshotReference`
- `KnowledgeReference`
- `MetadataReference`
- `UserTextReference`
- `DiagnosticReference`

No se transportan objetos de dominio completos por contrato.

## 5) Resolucion

Se define `ContextSourceResolverPort` provider-neutral.

- El builder no conoce proveedor, SDK ni transporte.
- La resolucion es sincronica y determinista por descriptor.
- Cualquier fallo de resolucion produce rechazo fail-closed.

Reglas de resolucion:

- descriptor desconocido -> `UNKNOWN_REFERENCE`;
- cobertura incompleta respecto al envelope -> `PARTIAL_RESOLUTION`;
- resultado invalido del resolver -> `RESOLUTION_FAILED` o `INVALID_FRAGMENT`.

## 6) Redaccion

Estrategias declarativas soportadas:

- `MASK`
- `REMOVE`
- `HASH_REFERENCE`
- `KEEP`

Aplicacion:

- campos sensibles: eliminacion (`REMOVE`) o conflicto si la policy exige redaccion incompatible;
- campos textuales: enmascarado (`MASK`);
- campos de referencia: hash determinista (`HASH_REFERENCE`).

No se inventa semantica nueva ni se resume informacion.

## 7) Minimization

Minimizacion automatica determinista:

- elimina campos internos/no autorizados;
- elimina metadatos de depuracion irrelevantes;
- elimina timestamps operacionales ambientales;
- elimina secretos, credenciales y trazas internas;
- elimina campos vacios;
- deduplica arrays de forma estable.

Si un fragmento queda invalido tras minimizacion, el builder rechaza.

## 8) AI Context Package

`AIContextPackage` contiene unicamente:

- `requestId`
- `purpose`
- `processingMode`
- `policyVersion`
- `protocolVersion`
- `orderedContextFragments`
- `appliedRedactions`
- `appliedMinimization`
- `traceability`

No contiene:

- snapshot financiero completo;
- knowledge collection completa;
- runtime interno;
- interacciones textuales;
- secretos.

## 9) Fail-Closed

8B rechaza sin package parcial ante:

- request o envelope invalido;
- resolver ausente;
- referencias no autorizadas;
- resolucion parcial;
- fragmentos invalidos;
- clasificacion por encima del maximo autorizado;
- violaciones del envelope;
- conflictos de redaccion;
- inconsistencias de resultado.

## 10) Determinismo

8B evita por diseno:

- `Date.now()`
- `new Date()`
- `Math.random()`
- `crypto.randomUUID()`

Ordenes aplicados de forma canonica:

- descriptors;
- fragments;
- redactions;
- minimization entries.

## 11) Inmutabilidad y JSON-safe

- El builder no muta envelope ni descriptors de entrada.
- La salida se valida como JSON-safe.
- Se usa clonacion defensiva para evitar mutacion observable.

## 12) Relacion con 8A

8A sigue siendo la frontera de autorizacion.

8B:

- consume exclusivamente envelopes autorizados;
- no amplia permisos ni categorias;
- no modifica purpose ni processing mode;
- aplica controles operativos sobre informacion ya autorizada.

## 13) Relacion futura con 8C

8B prepara un paquete neutral listo para la siguiente etapa de integracion.

8C podra introducir adaptacion de proveedor en frontera separada, manteniendo:

- enforcement de restricciones del package;
- sin romper determinismo ni fail-closed del builder.

## 14) Dependencias prohibidas

8B no introduce:

- red (`fetch`, HTTP clients, WebSocket);
- SDKs de IA;
- almacenamiento local o persistencia;
- UI o runtime de componentes.

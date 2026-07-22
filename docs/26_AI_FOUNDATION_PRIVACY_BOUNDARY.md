# 26 - AI Foundation Privacy Boundary (Milestone 8A)

## 1) Proposito de 8A

Milestone 8A define la frontera contractual y de privacidad para futuras capacidades de IA en Private Balance.

8A implementa:

- contratos provider-neutral;
- clasificacion de sensibilidad;
- catalogo de propositos permitidos/prohibidos;
- consentimiento especifico y versionado;
- politica versionada y restrictiva;
- autorizacion fail-closed para preparacion de request;
- envelope autorizado declarativo (sin payload financiero materializado);
- trazabilidad segura y determinista.

8A no implementa ejecucion de IA ni transporte de red.

## 2) Principio Default Deny

La decision por defecto es `DENY`.

Si hay ausencia, ambiguedad o inconsistencia en request, politica, consentimiento, trazabilidad o compatibilidad, la frontera:

- rechaza la operacion;
- no genera envelope autorizado;
- no hace downgrade silencioso de controles;
- no inventa consentimiento;
- no corrige scopes automaticamente;
- no produce autorizaciones parciales.

## 3) Arquitectura Provider-Neutral

```text
Future AI Consumer
        -> AI Privacy Boundary (8A)
           -> validate request
           -> validate policy
           -> validate purpose/mode/category/classification
           -> validate consent compatibility
           -> validate minimization/redaction/retention/training/logging
           -> validate traceability coherence
        -> Authorized AI Request Envelope (declarativo)
        -> Future Context Builder (fuera de 8A)
        -> Future LLM Adapter (fuera de 8A)
```

La frontera 8A es independiente de:

- proveedor especifico (OpenAI/Anthropic/Google/Apple);
- SDKs de proveedor;
- HTTP/WebSocket;
- React/UI;
- Dexie/IndexedDB;
- runtime interno del Insight Engine.

## 4) Frontera de Privacidad

La frontera publica es `AIPrivacyBoundaryPort` con el metodo:

- `authorize(request) => AIPrivacyAuthorizationResult`.

El metodo es:

- puro respecto a entrada/salida;
- sin estado global;
- sin singleton;
- sin IO;
- sincronico;
- determinista;
- fail-closed.

## 5) Clasificacion de Datos

Clasificacion cerrada:

- `PUBLIC`
- `INTERNAL`
- `PERSONAL`
- `FINANCIAL`
- `HIGHLY_SENSITIVE_FINANCIAL`
- `CREDENTIAL_OR_SECRET`

Orden de sensibilidad explicito:

`PUBLIC < INTERNAL < PERSONAL < FINANCIAL < HIGHLY_SENSITIVE_FINANCIAL < CREDENTIAL_OR_SECRET`

`CREDENTIAL_OR_SECRET` se rechaza siempre.

## 6) Categorias de Datos Autorizables

Categorias declarativas (sin payload materializado):

- `INSIGHT_SUMMARY`
- `INSIGHT_READ_MODEL`
- `FINANCIAL_SNAPSHOT`
- `KNOWLEDGE_COLLECTION`
- `USER_PROVIDED_TEXT`
- `APP_METADATA`
- `DIAGNOSTIC_METADATA`

8A solo autoriza referencias (`referenceId`, `selector`, `category`, `classification`).
No transporta objetos completos de dominio.

## 7) Propositos

Permitidos:

- `EXPLAIN_INSIGHT`
- `SUMMARIZE_FINANCIAL_STATE`
- `EDUCATIONAL_GUIDANCE`
- `GENERATE_ACTION_OPTIONS`
- `CLASSIFY_USER_QUERY`
- `DIAGNOSTIC_ANALYSIS`

Prohibidos:

- `EXECUTE_TRANSACTION`
- `MODIFY_FINANCIAL_DATA`
- `CHANGE_BUDGET_AUTOMATICALLY`
- `SHARE_DATA_WITH_THIRD_PARTIES`
- `TRAIN_EXTERNAL_MODEL`
- `PROFILE_FOR_ADVERTISING`
- `MAKE_HIGH_STAKES_DECISION_AUTONOMOUSLY`

Propositos desconocidos o prohibidos se rechazan.

## 8) Modos de Procesamiento

Implementados:

- `LOCAL_ONLY`
- `EXTERNAL_PROVIDER`

Reglas clave:

- `LOCAL_ONLY` puede procesar clasificaciones hasta `HIGHLY_SENSITIVE_FINANCIAL` (nunca secretos).
- `EXTERNAL_PROVIDER` requiere consentimiento explicito y restricciones mas estrictas.
- `EXTERNAL_PROVIDER` permite solo clasificaciones `PUBLIC|INTERNAL|PERSONAL`.

## 9) Modelo de Consentimiento

Contrato readonly `AIConsentRecord` con:

- `consentId` determinista;
- version de texto (`consentTextVersion`);
- `policyVersion` y `policyProtocolVersion`;
- `status` (`ACTIVE|REVOKED|INVALID`);
- scope especifico por proposito/categorias/modo;
- limite maximo de clasificacion;
- revocacion explicita;
- evidencia segura de confirmacion;
- validez declarativa sin dependencia de reloj ambiental.

No existe consentimiento implicito ni global ilimitado.

## 10) Politica de Privacidad Versionada

`AIPrivacyPolicy` incluye:

- version (`ai-privacy-policy/1.0.0`);
- protocolo soportado (`1`);
- `defaultDecision: DENY`;
- modos permitidos;
- propositos permitidos/prohibidos;
- politicas por modo;
- combinaciones prohibidas;
- regla de consentimiento exacto por version;
- limites de trazabilidad;
- orden canonicamente requerido.

### Restricciones por defecto para EXTERNAL_PROVIDER

- secretos prohibidos;
- entrenamiento externo prohibido;
- retencion no permitida mas alla de `PROHIBITED`;
- logging de contenido prohibido;
- minimizacion obligatoria;
- redaccion obligatoria;
- consentimiento explicito obligatorio;
- proposito especifico obligatorio.

## 11) Flujo de Autorizacion

### LOCAL_ONLY

1. Validar estructura de request.
2. Resolver y validar politica.
3. Validar protocolo/version.
4. Validar proposito y modo.
5. Validar categorias/clasificaciones.
6. Validar minimizacion/redaccion/retencion/training/logging segun policy.
7. Validar trazabilidad.
8. Emitir envelope autorizado declarativo.

### EXTERNAL_PROVIDER

Mismo flujo anterior, mas:

- consentimiento obligatorio y activo;
- match exacto de scope de consentimiento (proposito, categorias, modo, version de policy);
- restricciones reforzadas de clasificacion, retencion, training y logging.

## 12) Flujos de Rechazo

Rechazo fail-closed en:

- request invalido;
- politica ausente/incompatible;
- protocolo no soportado;
- proposito o modo no permitidos;
- categoria/clasificacion no autorizada;
- secreto detectado;
- consentimiento ausente/invalido/revocado/mismatch;
- conflicto de policy;
- mismatch de trazabilidad;
- inconsistencia interna de resultado.

## 13) Failure Codes

Catalogo cerrado:

- `INVALID_REQUEST`
- `MISSING_POLICY`
- `UNSUPPORTED_POLICY_VERSION`
- `UNSUPPORTED_PROTOCOL`
- `MISSING_CONSENT`
- `INVALID_CONSENT`
- `REVOKED_CONSENT`
- `CONSENT_PURPOSE_MISMATCH`
- `CONSENT_DATA_SCOPE_MISMATCH`
- `CONSENT_PROCESSING_MODE_MISMATCH`
- `PURPOSE_NOT_ALLOWED`
- `DATA_CATEGORY_NOT_ALLOWED`
- `DATA_CLASSIFICATION_NOT_ALLOWED`
- `PROCESSING_MODE_NOT_ALLOWED`
- `EXTERNAL_PROCESSING_NOT_AUTHORIZED`
- `SECRET_DATA_PROHIBITED`
- `RETENTION_POLICY_VIOLATION`
- `TRAINING_POLICY_VIOLATION`
- `LOGGING_POLICY_VIOLATION`
- `REDACTION_REQUIRED`
- `MINIMIZATION_REQUIRED`
- `POLICY_CONFLICT`
- `TRACEABILITY_MISMATCH`
- `INCONSISTENT_AUTHORIZATION_RESULT`

## 14) Envelope Autorizado

`AIAuthorizedRequestEnvelope` contiene solo metadata autorizada y declarativa:

- `requestId`;
- proposito y modo autorizados;
- referencias autorizadas (`referenceId/category/classification/selector`);
- categoria(s) autorizadas y clasificacion maxima;
- policy aplicada (id/version/protocol);
- consentimiento aplicado (id/scope/version) o `null`;
- requisitos de minimizacion y redaccion;
- reglas de gobernanza (retention/training/logging);
- restricciones para futuro Context Builder;
- trazabilidad segura.

No contiene:

- FinancialSnapshot materializado;
- KnowledgeCollection materializada;
- Insight materializado;
- prompts;
- mensajes de chat;
- secrets o API keys;
- payload para proveedor;
- respuesta de modelo.

## 15) Trazabilidad Segura

`AIPrivacyTraceability` expone:

- `traceId`, `relationId`, `requestId`;
- policy y consentimiento referenciados por id/version;
- proposito, modo y categorias autorizadas/rechazadas;
- decision y failure code;
- relacion request-policy y request-consent.

No expone valores financieros, texto libre de usuario, prompts ni secretos.

## 16) Minimization, Redaction, Retention, Training, Logging

8A modela y valida explicitamente:

- minimizacion (`applied + strategyCodes`);
- redaccion (`applied + strategyCodes`);
- retencion (`PROHIBITED|EPHEMERAL`);
- entrenamiento (`PROHIBITED|ALLOW_EXTERNAL`);
- logging (`NONE|METADATA_ONLY|CONTENT`).

Para `EXTERNAL_PROVIDER`, training/retention/logging de contenido se bloquean por defecto.

## 17) Determinismo

Con mismas entradas (request/policy/consent), misma salida.

8A no usa:

- `Date.now()`
- `new Date()`
- `Math.random()`
- `crypto.randomUUID()`
- locale/timezone ambiental
- fuentes de entropia

Colecciones relevantes se ordenan canonicamente.

## 18) Inmutabilidad

8A no muta:

- request;
- policy;
- consentimiento;
- metadata de entrada.

Estrategia:

- validacion estructural y canonicalizacion de arrays;
- clonacion defensiva en salida para evitar mutacion observable;
- contratos publicos readonly.

## 19) Dependencias Permitidas y Prohibidas

Permitidas:

- TypeScript puro;
- utilidades internas de tipos JSON-safe ya certificadas;
- contratos de dominio existentes solo para tipos (no materializacion).

Prohibidas en 8A:

- red (`fetch`, HTTP clients, WebSocket);
- SDKs IA/proveedor;
- `process.env`/`import.meta.env` para decisiones de autorizacion;
- React/UI;
- Dexie/IndexedDB;
- persistencia;
- prompts/generacion.

## 20) Amenazas Mitigadas

Mitigadas por 8A:

- exfiltracion accidental por defaults permisivos;
- uso externo sin consentimiento explicito;
- uso de secretos en pipeline IA;
- mezcla de datos fuera de scope consentido;
- logging de contenido sensible;
- autorizacion parcial silenciosa;
- no determinismo en decisiones de autorizacion.

## 21) Amenazas Pendientes

Pendientes para fases futuras:

- enforcement criptografico de evidencia de consentimiento;
- verificacion de cadena de confianza entre Context Builder y Adapter;
- auditoria distribuida de ejecucion efectiva en adapters remotos;
- controles de runtime sobre proveedor especifico (cuando exista).

## 22) Riesgos Conocidos

- 8A depende de que capas superiores suministren referencias de datos correctamente clasificadas.
- 8A no inspecciona payload financiero completo por diseno; requiere futuras politicas certificadas para derivacion de clasificacion.
- 8A no ejecuta ni supervisa transporte real; eso se delega a fases posteriores.

## 23) Relacion con fases futuras

8A habilita que una fase posterior prepare contexto bajo restricciones verificables.

Importante:

- una autorizacion 8A **no ejecuta IA**;
- una autorizacion 8A **no autoriza por si sola una transmision de red**;
- solo habilita la preparacion de una etapa posterior sujeta a nuevos controles.

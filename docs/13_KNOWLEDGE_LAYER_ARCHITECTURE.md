# 13. Knowledge Layer Architecture

## Objetivos

Milestone 5A establece la fundacion contractual del Knowledge Layer para Private Balance.
Milestone 5B implementa el builder deterministico inicial de facts sobre snapshot sellado.
Milestone 5C implementa el validador deterministico de colecciones de conocimiento draft.
Milestone 5D implementa la canonicalizacion versionada de colecciones validated.
Milestone 5E implementa el fingerprint criptografico determinista del documento canonico.
Milestone 5F implementa el sealer deterministico en memoria para snapshots de conocimiento.
Milestone 5G implementa el repository local append-only para snapshots de conocimiento sellados.
Milestone 5H implementa el Shadow Mode observacional de Knowledge a partir de un `SealedFinancialSnapshot` ya resuelto por Snapshot Shadow Mode.
Milestone 5I implementa una Promotion Policy pura para evaluar si un `SealedKnowledgeSnapshot` es elegible como Knowledge oficial, sin ejecutarla.
Milestone 5J implementa un Promotion Executor controlado, contextual y fail-closed para resolver un `SealedKnowledgeSnapshot` elegible desde `KnowledgeSnapshotRepository` sin convertir Knowledge en fuente visible de Home, Reports ni Insight Engine.

Objetivos del milestone:

- Definir contratos pasivos, inmutables y versionados para hechos de conocimiento.
- Establecer una capa estrictamente derivada de Financial Snapshot sellado.
- Garantizar determinismo, auditabilidad y reproducibilidad local-first.
- Dejar preparada la base para Insight Engine y LLM Assistant sin implementarlos.

## Arquitectura

Pipeline objetivo:

Dexie -> Financial Engine -> Financial Snapshot -> Knowledge Facts Builder -> Draft Knowledge Collection -> Knowledge Collection Validator -> Validated Knowledge Collection -> Knowledge Canonicalizer -> Canonical Knowledge Document -> Knowledge Fingerprint -> Knowledge Sealer -> Knowledge Snapshot Repository (local append-only) -> Insight Engine (futuro) -> LLM Assistant (futuro)

Knowledge Layer en este milestone:

- Introduce runtime local y puro para derivar facts (sin IO ni efectos colaterales).
- Introduce runtime local y puro para validar colecciones draft y promoverlas a validated.
- Introduce runtime local y puro para canonicalizar colecciones validated en un documento material versionado.
- Introduce persistencia local append-only en Dexie exclusivamente para `SealedKnowledgeSnapshot`.
- Introduce un servicio observacional explicito para ejecutar el pipeline completo de Knowledge en modo sombra.
- Introduce repository local exclusivo para persistencia append-only de Knowledge Snapshot sellado.
- No introduce interpretacion semantica avanzada ni narrativa.

La salida contractual de 5C es una ValidatedKnowledgeCollection.
La salida contractual de 5D es un CanonicalKnowledgeDocument.
La salida contractual de 5E es un KnowledgeFingerprint.
La salida contractual de 5F es un SealedKnowledgeSnapshot.
La salida contractual de 5G es un PersistedKnowledgeSnapshot y un KnowledgePersistenceResult.
La salida contractual de 5H es una observacion segura del pipeline de Knowledge sin promotion ni consumo visible.
La salida contractual de 5I es un `KnowledgePromotionAssessment` puro y auditable.
La salida contractual de 5J es una resolucion contextual `source = none | knowledge` con fallback cerrado, sin persistencia, sin modificacion de snapshots y sin consumir Knowledge como fuente oficial.
No se implementa Insight Engine ni LLM en esta fase.

## Milestone 5I — Knowledge Promotion Policy

Milestone 5I introduce una policy pura con funcion publica `assessKnowledgeSnapshotPromotion(snapshot)` y estas reglas normativas:

- Acepta exclusivamente `SealedKnowledgeSnapshot`.
- No acepta draft, validated, canonical document, fingerprint suelto ni Financial Snapshot.
- No calcula facts, no canonicaliza, no recalcula fingerprint y no persiste.
- No usa reloj, red, repository, Dexie, IndexedDB ni estado global.
- Evalua de forma fail-closed con checks explicitos y deterministas.
- Devuelve `KnowledgePromotionAssessment` con `eligible`, `checks`, `failedChecks` y `warnings`, sin score, heuristicas ni narrativa generada.

Checks implementados en 5I:

- estado `sealed`
- identidad consistente
- `knowledgeSnapshotId` valido
- `knowledgeSnapshotKey` valida
- revision valida
- `supersedes` coherente dentro del artefacto
- fingerprint presente
- algoritmo `SHA-256`
- encoding `hex-lower`
- domain correcto
- `fingerprintVersion` soportada
- `canonicalizationVersion` soportada
- `knowledgeVersion` soportada
- `builderVersion` soportada
- `rulesVersion` soportada
- `projectionVersion` soportada
- documento canonico presente
- facts presentes
- `factCount` coherente
- `factIds` unicos
- `factTypes` permitidos
- categorias coherentes
- relationships validas
- evidence valida
- metadata presente
- `sourceSnapshotId` presente
- `sourceSnapshotKey` presente
- `sourceSnapshotRevision` valida
- `sourceFingerprint` presente
- estado duplicado consistente contra el payload canonico
- contrato serializable
- valores permitidos

La policy no consulta latest real, no valida cadenas de repository, no verifica concurrencia, no comprueba idempotencia y no promueve nada. Esas responsabilidades quedan fuera del milestone y pertenecen a una fase posterior.

## Milestone 5J — Knowledge Promotion Executor controlado

Milestone 5J introduce `executeKnowledgePromotion(input)` como una capa contextual y reversible que resuelve un `SealedKnowledgeSnapshot` desde `KnowledgeSnapshotRepository` sin convertir Knowledge en fuente oficial ni visible de producto.

Reglas normativas:

- Feature flag independiente `VITE_KNOWLEDGE_PROMOTION_ENABLED`, desactivado por defecto y habilitado solo por el texto exacto `true`.
- Con el flag desactivado no se consulta el repository, no se ejecuta la Promotion Policy y la salida es `source = none` con `fallbackReason = feature_disabled`.
- Con el flag activado se resuelve la ultima revision real por `knowledgeSnapshotKey`, se valida la cadena completa, se recalcula el fingerprint oficial, se confirma `knowledgeSnapshotId`, `knowledgeSnapshotKey`, `sourceSnapshotId` y versiones soportadas, y solo entonces se ejecuta `assessKnowledgeSnapshotPromotion`.
- La decision no se persiste, no modifica snapshots y no reconstruye Knowledge.
- Cualquier fallo estructural, de cadena, de integridad o de policy retorna `source = none` con fallback cerrado.
- Los logs solo existen en desarrollo y omiten facts, evidence, documentos canonicos, fingerprints completos, importes y datos personales.
- No existe integracion visible con Home, Reports, Insight Engine, IA o LLM; Knowledge sigue sin ser fuente oficial.

Fallbacks normalizados introducidos en 5J:

- `feature_disabled`
- `not_found`
- `repository_error`
- `not_latest`
- `revision_conflict`
- `invalid_chain`
- `fingerprint_mismatch`
- `identity_mismatch`
- `key_mismatch`
- `source_mismatch`
- `incompatible_version`
- `policy_rejected`
- `invalid_contract`
- `internal_error`

La salida contractual incluye `source`, `snapshot?`, `assessment?`, `fallbackReason?` y `revision?`, manteniendo el executor aislado de consumidores visibles.

## Milestone 5H — Shadow Mode observacional

Milestone 5H introduce `knowledgeShadowModeService` con las siguientes reglas normativas:

- Punto unico de integracion: se ejecuta inmediatamente despues de que Snapshot Shadow Mode produzca o resuelva un `SealedFinancialSnapshot` compatible.
- Dependencia estricta: Knowledge solo consume snapshot sellado; no lee ingresos, egresos, Financial Engine ni tablas financieras para reconstruirlo.
- Feature flag independiente: `VITE_KNOWLEDGE_SHADOW_ENABLED`, desactivado por defecto y habilitado solo por el texto exacto `true`.
- Pipeline completo cuando el flag esta activo: builder -> validator -> canonicalizer -> fingerprint -> sealer -> repository.
- Pipeline nulo cuando el flag esta inactivo: resultado `skipped`, sin builder, sin sellado y sin persistencia.
- Idempotencia observacional: el mismo snapshot sellado y las mismas versiones cierran en el mismo `knowledgeSnapshotId` y no generan revisiones nuevas por `generatedAt`, `sealedAt`, `persistedAt`, re-render o reapertura.
- Fallo aislado: cualquier error de compatibilidad, builder, validator, canonicalizer, fingerprint, sealer, repository o comparacion devuelve `failed` dentro del modo sombra y nunca altera Home, Reports ni Snapshot Shadow Mode.
- Logs solo en desarrollo y con metadata segura: consumer, ids truncados, revision, factCount, factTypes, versiones y reasonCode. No se registran facts completos, documentos canonicos, importes ni evidencia completa.
- Knowledge sigue sin ser fuente oficial. No existen Promotion Policy, Promotion Executor, Insight Engine ni LLM en este milestone.

## Responsabilidades

Knowledge Layer Foundation se limita a:

- Modelar entidades de hechos de conocimiento.
- Modelar identidad determinista y revisionado append-only.
- Modelar trazabilidad hacia Snapshot sellado de origen.
- Modelar versionado propio desacoplado de Snapshot.
- Derivar un catalogo inicial cerrado de facts deterministas desde un unico snapshot sellado.
- Validar invariantes ejecutables sobre una DraftKnowledgeCollection sin generar nuevos facts.

## No-responsabilidades

Esta fundacion NO:

- Calcula balances ni metricas financieras.
- Duplica FinancialEngineResult.
- Duplica el documento completo de Snapshot.
- Ejecuta IO de red, persistencia o acceso a repositorios.
- Ejecuta persistencia o sincronizacion.
- Ejecuta IA, insights ni llamadas LLM.
- Ejecuta canonicalizacion, fingerprint, sellado, shadow mode ni promotion policy.

En 5H existe shadow mode exclusivamente como envoltura observacional del pipeline ya implementado; no convierte Knowledge en resultado visible ni en fuente oficial.
En 5I existe promotion policy exclusivamente como evaluacion pura de elegibilidad; no existe executor y no hay promotion efectiva.

## Contratos

Los contratos se definen en [src/types/knowledgeLayer.ts](src/types/knowledgeLayer.ts).

Componentes principales:

- KnowledgeFact
- KnowledgeSnapshot
- KnowledgeFactId
- KnowledgeFactType
- KnowledgeFactSource
- KnowledgeFactCategory
- KnowledgeFactSeverity
- KnowledgeFactConfidence
- KnowledgeVersion
- KnowledgeRevision
- KnowledgeMetadata
- KnowledgeEvidence
- KnowledgeContext
- KnowledgeScope
- KnowledgeIdentity
- KnowledgeStatus
- KnowledgeCollection
- KnowledgeProjection
- KnowledgeRelationship
- KnowledgeOrigin
- KnowledgeAuditTrail
- DraftKnowledgeCollection
- ValidatedKnowledgeCollection
- CanonicalKnowledgeDocument
- CanonicalKnowledgePayload
- CanonicalKnowledgeFact
- CanonicalKnowledgeEvidenceReference
- CanonicalKnowledgeRelationship
- KnowledgeCanonicalizationVersion
- KnowledgeCanonicalizationErrorCode
- KnowledgeFingerprint
- KnowledgeFingerprintErrorCode
- KnowledgeSnapshotKey
- KnowledgeRevisionReasonCode
- KnowledgeSealStatus
- KnowledgeSealErrorCode
- KnowledgeSealedIdentity
- KnowledgeSealingInput
- SealedKnowledgeSnapshot
- PersistedKnowledgeSnapshot
- KnowledgePersistenceResult
- KnowledgePersistenceError
- KnowledgePersistenceErrorCode
- KnowledgeCollectionIdentity
- KnowledgeCollectionVersions
- KnowledgeValidationAssessment
- KnowledgeValidationCheck
- KnowledgeValidationError
- KnowledgeValidationErrorCode

Todos los campos son readonly y sin metodos.

## Versionado

Knowledge Layer define versiones propias y desacopladas:

- KnowledgeVersion
- KnowledgeBuilderVersion
- KnowledgeRulesVersion
- KnowledgeProjectionVersion
- KnowledgeCanonicalizationVersion

Regla normativa:

- Ninguna de estas versiones reutiliza el namespace de versionado de Snapshot.

## Invariantes

Invariantes formales del dominio contractual:

1. Unicidad:
- Cada KnowledgeFactId identifica de forma determinista un hecho en un contexto y origen dados.

2. Identidad:
- KnowledgeIdentity se deriva sin UUID, sin aleatoriedad y sin reloj local.

3. Referencias:
- Todo hecho mantiene referencia explicita al Snapshot sellado de origen por id/key/revision.

4. Consistencia:
- KnowledgeFacts y KnowledgeRelationships pertenecen a un mismo KnowledgeScope.

5. Versionado:
- Metadata conserva version de Knowledge, Builder, Rules y Projection en cada revision.

6. Relaciones:
- Toda relacion referencia fact IDs existentes dentro de la misma coleccion.

7. Auditabilidad:
- KnowledgeAuditTrail registra origen de snapshot y marcador append-only.

8. Proyeccion:
- KnowledgeProjection contiene exclusivamente facts y relaciones; no contiene balances.

9. Compatibilidad:
- Evoluciones futuras deben introducir nuevas revisiones append-only y preservar artefactos previos.

10. Inmutabilidad:
- KnowledgeSnapshot es append-only; una nueva interpretacion crea nueva revision y nunca modifica revisiones previas.

11. Determinismo operativo:
- El builder no usa reloj, aleatoriedad ni criptografia para construir facts e IDs.

12. Catalogo inicial cerrado (5B):
- Tipos permitidos: `balance.{positive|negative|neutral}`, `income.{present|absent}`, `expense.{present|absent}`, `adjustment.{present|absent}`, `cashflow.{positive|negative|neutral}`, `period.{empty|non_empty}`.

13. Trazabilidad minima:
- Cada fact mantiene `origin` y `evidence` con referencia a snapshot id/key/revision/fingerprint y rutas de origen usadas.

14. Separacion de estados:
- El validador solo acepta `DraftKnowledgeCollection` y devuelve `ValidatedKnowledgeCollection`.

15. No generacion en validacion:
- La validacion no crea facts, no modifica IDs y no reordena silenciosamente la coleccion.

16. Versiones cerradas:
- `knowledgeVersion`, `builderVersion`, `rulesVersion` y `projectionVersion` se validan contra matriz cerrada sin forward-compatibility implicita.

17. Identidad obligatoria:
- Toda coleccion draft debe incluir `knowledgeCollectionId`, `sourceSnapshotId`, `sourceSnapshotKey`, `sourceSnapshotRevision` y `sourceFingerprintValue`.

18. Integridad de facts:
- IDs unicos, formato determinista valido, orden canonico estable y ordinales contiguos.

19. Coherencia de catalogo:
- Fact type, category, severity y confidence deben cumplir el contrato del catalogo determinista actual.

20. Matriz de contradicciones:
- Grupos exclusivos con cardinalidad exacta 1: balance, income, expense, adjustment, cashflow y period.

21. Coherencia de periodo:
- `period.empty` requiere `income.absent`, `expense.absent`, `adjustment.absent`.
- `period.non_empty` requiere al menos una presencia material (`income.present` o `expense.present` o `adjustment.present`).

22. Higiene estructural:
- Rechazo fail-closed de null, undefined material, Date, NaN, Infinity, bigint, funciones, simbolos, prototipos personalizados y ciclos estructurales.

23. Serializacion estricta:
- La coleccion draft debe ser JSON-serializable sin excepciones (`JSON.stringify`) como requisito ejecutable de auditabilidad local.

24. Relaciones seguras:
- Relaciones solo entre fact IDs existentes, sin auto-referencias prohibidas y sin ciclos cuando el contrato los prohibe.
- Tipos de relacion permitidos unicamente: `derived-from`, `supports`, `correlates-with`.

25. Privacidad:
- La coleccion validada no incluye FinancialEngineResult, CanonicalSnapshotDocument completo, notas libres ni PII.

26. Canonicalizacion versionada (5D):
- La canonicalizacion acepta solo `ValidatedKnowledgeCollection` y emite `CanonicalKnowledgeDocument` con `canonicalizationVersion` explicita.
- Version cerrada implementada: `knowledge-c14n/1.0.0`.

27. Orden canonicamente estable:
- Objetos por claves lexicograficas con comparacion directa (`<` y `>`), sin `localeCompare`.
- Facts ordenados por `category`, `factType`, `ordinal` y `factId`.
- Relationships ordenadas por `sourceFactId`, `relationshipType`, `targetFactId`.
- Evidence references ordenadas por snapshot de origen, tipo de evidencia, valor y desempate final por `factId`.

28. Politica numerica:
- Solo numeros finitos.
- `-0` se normaliza a `0`.
- No se redondea, no se trunca y no se convierte a string.

29. Opcionales y nulabilidad:
- Ausencia permanece ausencia.
- Array vacio permanece vacio.
- String vacio valido permanece string vacio.
- Cero permanece cero.
- `null` y `undefined` material se rechazan.

30. Serializacion determinista:
- `serializeCanonicalKnowledgeDocument` serializa exclusivamente un documento ya canonicalizado y produce string estable para la misma entrada.

31. Separacion de responsabilidades:
- Validator (5C) valida invariantes y estados Draft/Validated.
- Canonicalizer (5D) ordena y normaliza material validado.
- Fingerprint (5E) calcula integridad criptografica sobre documento canonicamente estable.
- Ninguna de estas capas sella artefactos o persiste estado.

32. Fingerprint V1 (5E):
- Algoritmo: `SHA-256`.
- Encoding de entrada: `UTF-8`.
- Salida: `hex-lower` de 64 caracteres.
- Domain separator cerrado: `private-balance:knowledge:fingerprint:v1:`.

33. Preimagen de fingerprint:
- Incluye `CanonicalKnowledgeDocument` completo y material explicitado: `canonicalizationVersion`, versiones Knowledge (knowledge/builder/rules/projection), identidad, facts, relationships, evidence, scope y metadata material.
- No incluye reloj, UUID, aleatoriedad, persistencia, repository, sellado, Insight Engine ni LLM.

34. Determinismo criptografico:
- El mismo documento canonico produce el mismo hash.
- Cualquier cambio material en facts, relationships, evidence, versiones, scope o metadata produce hash distinto.

35. Sellado deterministico en memoria (5F):
- `sealCanonicalKnowledgeDocument` opera sin IO, sin reloj y sin aleatoriedad.
- Rechaza fail-closed estructuras inseguras (`null`, `undefined`, `Date`, `NaN`, `Infinity`, `bigint`, funciones, simbolos, prototipos personalizados y ciclos).
- Recalcula fingerprint oficial y compara algoritmo, encoding, domain, fingerprintVersion, canonicalizationVersion y value.

36. Politica de revision y supersedes (5F):
- `revision` debe ser entero seguro >= 1.
- `revision = 1` exige ausencia de `supersedesKnowledgeSnapshotId`.
- `revision > 1` exige `supersedesKnowledgeSnapshotId` no vacio.
- Se rechaza self-supersedes.

37. Politica de sellado temporal (5F):
- `sealedAt` debe venir provisto por el caller en formato UTC RFC3339 con milisegundos (`YYYY-MM-DDTHH:mm:ss.SSSZ`).
- El sealer no genera timestamps.

38. Identidad final deterministicamente derivada (5F):
- `knowledgeSnapshotId = knowledge-snapshot:${fingerprintVersion}:${fingerprint.value}`.
- `knowledgeSnapshotKey` se deriva de un material estable: referencias de snapshot origen, versiones Knowledge, `canonicalizationVersion`, firma normalizada de scope y catalogo de facts.
- `revision`, `revisionReasonCode` y `sealedAt` no alteran `knowledgeSnapshotId` ni `knowledgeSnapshotKey`.

39. Estado y no-responsabilidades del sealer (5F):
- `status` de salida es siempre `sealed`.
- El sealer no persiste, no publica, no sincroniza, no usa repository, no ejecuta Insight Engine y no llama LLM.

40. Repository local append-only (5G):
- Tabla Dexie: `knowledgeSnapshots`.
- Primary key content-addressed: `knowledgeSnapshotId`.
- Índice único compuesto: `[knowledgeSnapshotKey+revision]`.
- Índices adicionales mínimos: `knowledgeSnapshotKey`, `sealedAt`, `status`, `sourceSnapshotId`, `sourceSnapshotKey`, `fingerprintValue`, `knowledgeVersion`, `projectionVersion`.

41. Politica de revision e idempotencia (5G):
- La revisión se asigna dentro de transacción Dexie (`latest + 1`, primera = 1).
- No se confía ciegamente en la revisión externa.
- Si el `knowledgeSnapshotId` ya existe, el resultado es éxito idempotente (sin duplicar).
- No se crean huecos de revisión.

42. Politica de supersedes (5G):
- `revision = 1`: sin `supersedesKnowledgeSnapshotId`.
- `revision > 1`: `supersedesKnowledgeSnapshotId` debe existir y referenciar la revisión inmediatamente anterior de la misma `knowledgeSnapshotKey`.
- Cadenas incompatibles se rechazan fail-closed.

43. Integridad de persistencia (5G):
- El repository verifica integridad usando el sealer oficial antes de insertar.
- Valida identidad content-addressed y coherencia fingerprint/documento canónico.
- No recalcula facts ni reconstruye Knowledge Layer.

44. Inmutabilidad y retencion (5G):
- Input no mutado.
- Lecturas devuelven copias independientes.
- Sin `update` ni `delete` públicos.
- Retención total de revisiones en v1 (sin borrado automático).

## Matriz de contradicciones (5C)

- balance: `balance.positive` | `balance.negative` | `balance.neutral`
- income: `income.present` | `income.absent`
- expense: `expense.present` | `expense.absent`
- adjustment: `adjustment.present` | `adjustment.absent`
- cashflow: `cashflow.positive` | `cashflow.negative` | `cashflow.neutral`
- period: `period.empty` | `period.non_empty`

Regla: cualquier coleccion con mas de un fact simultaneo en un mismo grupo exclusivo es invalida y se rechaza.

## Compatibilidad de versiones (5C)

Matriz cerrada soportada por el validador:

- `knowledge/1.0.0`
- `knowledge-builder/1.0.0`
- `knowledge-rules/1.0.0`
- `knowledge-projection/1.0.0`

Version desconocida o vacia: validacion negativa determinista.

## Riesgos

- Riesgo de sobrecarga semantica en tipos de hechos sin governance de catalogo.
- Riesgo de proliferacion de relaciones sin taxonomia cerrada de relation types.
- Riesgo de drift entre versiones de reglas de conocimiento y su documentacion.
- Riesgo de trazabilidad incompleta si futuras capas omiten referencias de origen.

## Decisiones abiertas

- Definir catalogo normativo completo y evolutivo de KnowledgeFactType.
- Definir politica de compatibilidad entre KnowledgeRulesVersion y KnowledgeProjectionVersion.
- Definir estrategia de persistencia local append-only para KnowledgeSnapshot (fuera de este milestone).
- Definir interfaz de consumo para Insight Engine sin romper invariantes de pureza.

## Roadmap

Milestone 5B (implementado): Knowledge Facts Builder Deterministico

- Builder puro `buildKnowledgeCollectionFromSnapshot`.
- IDs deterministas `knowledge-fact:<knowledgeVersion>:<snapshotId>:<factType>:<ordinal>`.
- Orden estable por categoria/tipo y validaciones fail-closed.
- Suite de 50 tests de determinismo, invariantes, compatibilidad y restricciones de no-IO.

Milestone 5C (implementado): Knowledge Collection Validator

- Funcion publica `validateKnowledgeCollection`.
- Separacion Draft/Validated sin mezclar estados.
- Invariantes ejecutables y matriz de contradicciones cerrada.
- Sin generacion de nuevos facts.
- Suite dedicada de 50 tests de validacion y fail-closed.

Milestone 5D (implementado): Knowledge Canonicalization Versionada

- Funcion publica `canonicalizeValidatedKnowledgeCollection`.
- Funcion pura `serializeCanonicalKnowledgeDocument` para serializacion determinista.
- Version canonicamente cerrada `knowledge-c14n/1.0.0`.
- Orden canonico estable para objetos, facts, relationships y evidence references.
- Politica numerica explicita con normalizacion `-0 -> 0`.
- Sin fingerprint, sin sellado y sin persistencia.

Milestone 5E (implementado): Knowledge Fingerprint Determinista

- Funcion publica asincrona `fingerprintCanonicalKnowledgeDocument`.
- Usa exclusivamente Web Crypto (`crypto.subtle.digest`) con `SHA-256`.
- Domain separator dedicado `private-balance:knowledge:fingerprint:v1:`.
- Preimagen basada en documento canonico y metadatos materiales de Knowledge Layer.
- Sin sellado, sin repository y sin persistencia.

Milestone 5F (implementado): Knowledge Sealer

- Funcion publica asincrona `sealCanonicalKnowledgeDocument` para sellado en memoria de `CanonicalKnowledgeDocument + KnowledgeFingerprint`.
- Funcion pura `deriveKnowledgeSnapshotKey` para clave determinista de identidad semantica estable.
- Verificacion estricta del fingerprint oficial en todas sus dimensiones antes de sellar.
- Politica explicita de revision/supersedes/sealedAt con fail-closed.
- Salida contractual `SealedKnowledgeSnapshot` con estado fijo `sealed` y estructura deep-cloned.
- Sin persistencia, sin repository, sin red, sin Insight Engine y sin LLM.

Milestone 5G (implementado): Knowledge Repository Local Append-Only

- Contrato persistido `PersistedKnowledgeSnapshot` con denormalización mínima para índices.
- Repository `KnowledgeSnapshotRepository` con API: `persist`, `getByKnowledgeSnapshotId`, `listByKnowledgeSnapshotKey`, `getLatestByKnowledgeSnapshotKey`, `exists`.
- Persistencia local transaccional e idempotente en Dexie.
- Protección append-only por hooks de `updating` y `deleting` en tabla `knowledgeSnapshots`.
- Sin Shadow Mode, sin Promotion Policy, sin Insight Engine y sin LLM.

Milestone 5H (recomendado): Insight Engine Foundation

- Consumir CanonicalKnowledgeDocument sin acceso directo a Financial Engine.
- Mantener separacion estricta entre hechos, insights y narrativa.

Milestone 5I (recomendado): LLM Adapter Boundary

- Exponer solo hechos e insights auditables.
- Bloquear acceso del LLM a capas no autorizadas.

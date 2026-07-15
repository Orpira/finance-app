# 11 — Financial Snapshot Domain Invariants

> **DOCUMENTO NORMATIVO — SIN IMPLEMENTACIÓN**
>
> Este documento formaliza las reglas que cualquier implementación futura de Financial Snapshot deberá cumplir. No implementa validadores, Builder, canonicalización, fingerprint, persistencia, servicios ni comportamiento runtime.

## 1. Estado, alcance y autoridad

- **Tipo:** especificación normativa de invariantes del dominio.
- **Milestone:** Financial Snapshot 3A.5.
- **Estado implementado:** documentación exclusivamente; ninguna regla de este documento se ejecuta todavía.
- **Ámbito:** contratos definidos en `src/types/financialSnapshot.ts`.
- **Autoridad superior:** `PRIVATE_BALANCE_CONSTITUTION.md` y ADRs aceptadas.
- **Arquitectura marco:** `09_AI_CORE_ARCHITECTURE.md`.
- **Especificación del componente:** `10_FINANCIAL_SNAPSHOT_ARCHITECTURE.md`.

Si una regla de este documento contradice la Constitución, prevalece la Constitución. Si una futura implementación no puede satisfacer un invariante, deberá detenerse y proponer una ADR o revisión documental; no podrá relajar la regla silenciosamente.

### 1.1 Significado normativo

Las palabras siguientes tienen carácter preciso:

- **DEBE / OBLIGATORIO:** condición necesaria para que el artefacto sea válido.
- **NO DEBE / PROHIBIDO:** condición que invalida el artefacto.
- **PUEDE:** opción compatible, sujeta a las demás reglas.
- **PENDIENTE:** decisión que debe cerrarse antes de implementar la fase afectada.

### 1.2 Qué cubre este documento

Formaliza invariantes para:

- `FinancialSnapshot`;
- `FinancialSnapshotInput`;
- `FinancialSnapshotMetadata`;
- `SnapshotIdentity`;
- `SnapshotRevision`;
- `SnapshotVersion`;
- `SnapshotStatus`;
- `SnapshotScope`;
- `FinancialEvidence` y sus registros;
- `AppliedRule`;
- `CanonicalSnapshot` como contrato de datos futuro;
- `SnapshotFingerprint` como contrato de datos futuro.

La presencia de estos nombres no implica que puedan construirse o validarse actualmente.

## 2. Principios de validez

Un Financial Snapshot solo será válido si satisface simultáneamente todos los grupos de invariantes aplicables. Cumplir un grupo no compensa el incumplimiento de otro.

La validez se divide conceptualmente en:

1. **validez estructural:** campos presentes y tipos correctos;
2. **validez semántica:** relaciones coherentes entre identidad, scope, versiones y evidencia;
3. **validez financiera:** resultado producido exclusivamente por Financial Engine;
4. **validez temporal:** periodo, `asOf` y generación no se contradicen;
5. **validez histórica:** revisión y sustitución preservan la cadena append-only;
6. **validez de auditoría:** existe evidencia suficiente y explicable;
7. **validez serializable:** el artefacto puede representarse sin pérdida en el formato aprobado;
8. **validez canónica:** fase futura; representación normalizada estable;
9. **validez de integridad:** fase futura; fingerprint correcto.

En Milestone 3A.5 solo se documentan estas condiciones. No existe todavía un mecanismo que certifique ninguna de ellas.

## 3. Invariantes generales

### INV-GEN-001 — Una sola fuente financiera operativa

Dexie continúa siendo el libro financiero operativo canónico. Un snapshot nunca crea, reemplaza ni corrige movimientos.

### INV-GEN-002 — Una sola autoridad de cálculo derivado

El estado financiero incluido en `CanonicalSnapshot.financialState` DEBE proceder de Financial Engine. Ningún Builder, serializer, repositorio o consumidor futuro podrá duplicar fórmulas.

### INV-GEN-003 — Solo lectura

La producción, validación, lectura o revisión de un snapshot NO DEBE modificar ingresos, gastos, ajustes, citas, temporadas, tasas, configuración ni resultados legacy.

### INV-GEN-004 — Local-first

La validez de un snapshot NO DEBE depender de Neon, n8n, Vercel, Evolution API, WhatsApp, red, MCP o proveedores de IA.

### INV-GEN-005 — Determinismo

Las mismas entradas materiales, scope, versiones, reglas y versión de motor DEBEN producir el mismo estado financiero. En fases futuras también deberán producir la misma representación canónica y el mismo fingerprint.

### INV-GEN-006 — Inmutabilidad lógica

Desde el estado `sealed`, ningún campo material puede modificarse. Un cambio requiere una nueva revisión y nueva identidad técnica.

### INV-GEN-007 — Sin comportamiento en el modelo

Los contratos del dominio permanecen como datos readonly y serializables. No contienen métodos, acceso a almacenamiento, clocks, red, cálculos ni efectos secundarios.

### INV-GEN-008 — Sin promoción implícita

La validez de un snapshot no autoriza su uso por Home, Reports ni otro consumidor. La promoción futura será explícita, por consumidor y reversible.

### INV-GEN-009 — Sin significado de cierre contable

Un snapshot no bloquea periodos, no altera mutabilidad y no equivale a un cierre financiero.

### INV-GEN-010 — Sin inferencias no declaradas

Ningún campo ausente puede inventarse o completarse. Ausencia, `null`, vacío y cero mantienen significados distintos cuando la versión lo establezca.

### INV-GEN-011 — Coherencia transversal

Los valores repetidos entre input, metadata, canonical, fingerprint y revisión DEBEN coincidir exactamente. La duplicación estructural no permite divergencia semántica.

### INV-GEN-012 — Fallo cerrado

Un artefacto incompleto, ambiguo, incompatible o no reproducible no puede sellarse, publicarse ni usarse como evidencia válida.

## 4. Invariantes de identidad

### INV-ID-001 — Identidad obligatoria

Todo `FinancialSnapshot` sellado o posterior DEBE tener `snapshotId` y `snapshotKey` no vacíos.

### INV-ID-002 — Identificador técnico único

`snapshotId` identifica una revisión concreta. No puede reutilizarse para otro contenido, key, revisión o estado financiero.

### INV-ID-003 — Clave lógica estable

`snapshotKey` identifica el ámbito lógico, no una revisión. DEBE derivarse exclusivamente de dimensiones materiales aprobadas del scope.

### INV-ID-004 — Dimensiones mínimas de la key

La key futura deberá distinguir, como mínimo:

- scope kind;
- periodo;
- política de límite temporal;
- timezone;
- modo de uso;
- moneda;
- periodo profesional cuando aplique;
- filtros materiales;
- sujeto local autorizado cuando se defina.

### INV-ID-005 — Campos prohibidos en la key

`snapshotKey` NO DEBE depender de:

- revisión;
- estado;
- `generatedAt`;
- duración de ejecución;
- orden de lectura;
- feature flags;
- dispositivo o navegador;
- estado de sincronización;
- IDs de persistencia;
- canales o datos WhatsApp.

### INV-ID-006 — Misma key, mismo significado lógico

Dos snapshots con la misma key DEBEN referirse al mismo ámbito lógico. Pueden tener evidencia o versiones distintas únicamente como revisiones distintas.

### INV-ID-007 — Diferente ámbito, diferente key

Si cambia cualquier dimensión material de identidad, debe cambiar la key. No puede usarse una revisión para ocultar un cambio de ámbito lógico.

### INV-ID-008 — Identidad no inferida desde datos sensibles

Notas libres, teléfono, owner JID, licencia, PIN, token o credencial nunca forman parte de la identidad.

### INV-ID-009 — Formato pendiente, semántica obligatoria

El encoding concreto de `snapshotId` y `snapshotKey` queda pendiente. Cualquier formato elegido deberá ser estable, inequívoco y serializable.

## 5. Invariantes de revisión

### INV-REV-001 — Revisión positiva

`SnapshotRevision.revision` DEBE ser un entero finito mayor o igual que 1.

### INV-REV-002 — Primera revisión

La revisión `1` NO DEBE declarar `supersedesSnapshotId`.

### INV-REV-003 — Revisión posterior

Toda revisión mayor que `1` DEBE declarar el `snapshotId` de la revisión inmediatamente anterior de la misma `snapshotKey`.

### INV-REV-004 — Secuencia monotónica

Las revisiones de una misma key avanzan de forma estrictamente creciente. No se reutilizan números ni se retrocede.

### INV-REV-005 — Sin edición retroactiva

Crear una revisión no modifica identidad, contenido, metadata material, fingerprint ni evidencia de revisiones anteriores.

### INV-REV-006 — Motivo obligatorio

`SnapshotRevision.reason` DEBE ser un código o valor estructurado no vacío. No debe depender de narrativa libre para adquirir significado.

### INV-REV-007 — Causas materiales

Una revisión nueva se justifica cuando cambia al menos uno de estos elementos:

- evidencia incluida o excluida;
- universo de entrada;
- estado financiero;
- regla aplicada;
- `engineVersion`;
- `snapshotVersion`;
- versión de canonicalización;
- política de fingerprint;
- contexto material dentro de la misma key;
- corrección explícita de un artefacto inválido.

### INV-REV-008 — No revisión por metadata volátil

No se crea una revisión únicamente porque cambien tiempo de ejecución, orden incidental, logs, reintentos o estado de sincronización.

### INV-REV-009 — Sin bifurcación silenciosa

Dos revisiones diferentes no pueden declarar la misma revisión anterior como predecesora activa sin una política explícita de resolución. Las ramas históricas quedan pendientes de decisión y no se admitirán por defecto.

### INV-REV-010 — Misma key en toda la cadena

Una revisión solo puede sustituir a otra con la misma `snapshotKey`.

### INV-REV-011 — Sustitución no es borrado

`superseded` conserva el artefacto anterior. No implica eliminación, compactación ni pérdida de evidencia.

## 6. Invariantes de SnapshotVersion

### INV-VER-001 — Versión obligatoria

`SnapshotVersion` DEBE existir, ser no vacía y pertenecer al conjunto de versiones soportadas por el productor y lector correspondientes.

### INV-VER-002 — Coincidencia exacta

Los siguientes valores DEBEN coincidir:

- `FinancialSnapshotInput.snapshotVersion`;
- `FinancialSnapshotMetadata.snapshotVersion`;
- `CanonicalSnapshot.snapshotVersion`.

### INV-VER-003 — Significado inmutable

Una versión publicada no cambia de significado. No puede modificarse retroactivamente su esquema, semántica, invariantes o interpretación.

### INV-VER-004 — Versión desconocida

Una versión desconocida o no soportada invalida la lectura semántica. El artefacto puede conservarse como bytes, pero no declararse válido ni comparable.

### INV-VER-005 — Cambio material

Todo cambio material de campos, significado, evidencia requerida, representación temporal, precisión, orden o composición canónica exige nueva versión.

### INV-VER-006 — No reetiquetado

Un snapshot antiguo nunca se convierte a una versión nueva cambiando su etiqueta. Debe reconstruirse como una nueva revisión o nuevo artefacto según la política aprobada.

### INV-VER-007 — Versiones ortogonales

`snapshotVersion`, `canonicalizationVersion`, `engineVersion`, `ruleVersion`, `fingerprintVersion` y revisión son dimensiones independientes. Ninguna sustituye a otra.

### INV-VER-008 — Compatibilidad explícita

Dos versiones solo pueden compararse si existe una matriz de compatibilidad aprobada. Igualdad de campos nominales no demuestra compatibilidad.

### INV-VER-009 — Formato estable

El formato concreto queda pendiente, pero no podrá depender de locale, fecha de build implícita ni orden de despliegue.

## 7. Invariantes de SnapshotStatus

### INV-STA-001 — Estado conocido

`SnapshotStatus` solo puede usar un valor definido por el contrato vigente.

### INV-STA-002 — Flujo permitido

Las transiciones conceptualmente permitidas son:

```text
requested -> building
building -> validated
validated -> sealed
sealed -> persisted
persisted -> published
published -> superseded

requested | building | validated -> failed
sealed | persisted | published -> invalidated
```

No se admiten saltos ni retrocesos fuera de una política futura explícita.

### INV-STA-003 — Estados transitorios no son evidencia sellada

`requested`, `building`, `validated` y `failed` describen un candidato o ejecución, no un `FinancialSnapshot` final verificable.

### INV-STA-004 — Estado mínimo del artefacto completo

Un objeto que contenga `CanonicalSnapshot` definitivo y `SnapshotFingerprint` definitivo solo puede considerarse artefacto financiero válido desde `sealed`.

### INV-STA-005 — Published requiere persistencia

Dentro del flujo actualmente aprobado, `published` requiere una revisión previamente `persisted`. Publicación no significa sincronización remota.

### INV-STA-006 — Superseded requiere sucesor

Un snapshot solo puede marcarse `superseded` cuando existe una revisión posterior válida que lo referencia.

### INV-STA-007 — Invalidated no se rehabilita in-place

Un snapshot invalidado no vuelve a `sealed`, `persisted` o `published`. La recuperación crea otra revisión.

### INV-STA-008 — Failed no es snapshot histórico

Un fallo puede conservar trazabilidad técnica futura, pero no forma parte de la cadena de evidencia financiera publicada.

### INV-STA-009 — Estado fuera del contenido material

El estado de ciclo de vida no altera retroactivamente el contenido financiero sellado. La futura composición del fingerprint deberá excluir estados operacionales mutables o definir claramente qué estado material sella.

### INV-STA-010 — Tensión estructural actual

El contrato 3A permite estructuralmente combinar cualquier `SnapshotStatus` con canonical y fingerprint obligatorios. Antes del Builder debe decidirse si:

1. se separan candidato, ejecución y snapshot sellado; o
2. se mantienen en un único contrato con validación discriminada.

Hasta resolverlo, combinaciones transitorias con artefactos definitivos deben tratarse como inválidas semánticamente.

## 8. Invariantes de FinancialEvidence

### INV-EVI-001 — Evidencia suficiente

La evidencia DEBE contener o referenciar inmutablemente todos los campos materiales necesarios para reproducir el resultado sin consultar el estado vivo actual.

### INV-EVI-002 — Evidencia mínima

No debe copiar campos que no participen en cálculo, pertenencia al scope, clasificación, explicación o auditoría aprobada.

### INV-EVI-003 — Fuente permitida

En el modelo 3A, `FinancialEvidenceRecord.source` solo puede ser `income` o `expense`, coherente con la entrada real del adapter actual.

### INV-EVI-004 — Disposición obligatoria

Cada registro se clasifica exactamente como `included` o `excluded`.

### INV-EVI-005 — Exclusión explicada

Un registro `excluded` DEBE tener `exclusionCode` no vacío y determinista.

### INV-EVI-006 — Inclusión sin exclusión

Un registro `included` NO DEBE tener `exclusionCode`.

### INV-EVI-007 — Conteos no negativos

`candidateRecordCount`, `includedRecordCount` y `excludedRecordCount` deben ser enteros finitos mayores o iguales que cero.

### INV-EVI-008 — Ecuación de conteos

Siempre debe cumplirse:

```text
candidateRecordCount = includedRecordCount + excludedRecordCount
```

### INV-EVI-009 — Conteos embebidos

Cuando la estrategia sea evidencia embebida completa:

```text
records.length = candidateRecordCount
count(records included) = includedRecordCount
count(records excluded) = excludedRecordCount
```

### INV-EVI-010 — Evidencia referenciada

Si `evidenceReference` apunta a evidencia no embebida:

- la referencia debe ser estable e inmutable;
- `evidenceFingerprint` será obligatorio;
- los conteos siguen siendo obligatorios;
- la ausencia del paquete referenciado impide reproducción y publicación;
- una referencia a registros vivos de Dexie no es válida.

### INV-EVI-011 — Estrategia inequívoca

La implementación deberá distinguir evidencia embebida de evidencia referenciada. No puede interpretar silenciosamente una colección parcial como evidencia completa.

### INV-EVI-012 — Campos materiales serializables

`materialFields` solo contiene valores representables por `SnapshotJsonValue`. No admite funciones, símbolos, bigint, `Date`, clases, referencias cíclicas, `undefined`, `NaN` o infinitos.

### INV-EVI-013 — No normalización financiera

La proyección de evidencia no corrige, redondea, recalcula moneda, sanea negativos ni reclasifica registros.

### INV-EVI-014 — Trazabilidad de identidad

Cuando `sourceId` existe, debe conservarse exactamente. Cuando no existe, la futura política de identidad canónica debe proporcionar un desempate reproducible sin inventar un ID operativo.

### INV-EVI-015 — Fecha lógica obligatoria

`logicalDate` debe representar la fecha usada para decidir pertenencia al scope. No puede sustituirse por `createdAt` salvo que la regla financiera lo defina.

### INV-EVI-016 — Scope y evidencia coherentes

Todo registro `included` debe pertenecer al scope. Un registro fuera del scope solo puede aparecer como `excluded` y con código explicativo, si la política de universo de entrada lo permite.

### INV-EVI-017 — Modos no mezclados

Un snapshot básico no incluye evidencia profesional y viceversa, salvo registros legacy cuya pertenencia sea resuelta explícitamente por la regla existente de uso.

### INV-EVI-018 — Valores históricos

Cuando una conversión almacenada participa en el cálculo, la evidencia debe conservar los valores históricos realmente seleccionados. No puede sustituirlos por una tasa actual.

### INV-EVI-019 — Ajustes preservados

La evidencia conserva la clasificación ingreso, gasto o ajuste utilizada por Financial Engine. Un ajuste no puede colapsarse con otro tipo.

### INV-EVI-020 — Privacidad

La evidencia nunca incluye PIN, licencias, tokens, secretos, QR, pairing codes, owner JID, teléfonos o datos de canal. Notas libres se excluyen por defecto.

### INV-EVI-021 — Códigos estables

`coverageCodes`, `warningCodes` y `exclusionCode` deben pertenecer a catálogos versionados futuros. Texto libre no puede ser su única semántica.

### INV-EVI-022 — Colecciones readonly

Ninguna implementación puede mutar `records`, códigos o `materialFields` recibidos. Las transformaciones futuras producirán nuevos valores.

## 9. Invariantes de AppliedRule

### INV-RUL-001 — Procedencia exclusiva

Las reglas aplicadas proceden exclusivamente de Financial Engine. Snapshot Builder no las infiere ni añade.

### INV-RUL-002 — ID obligatorio

Cada `ruleId` debe ser estable y no vacío.

### INV-RUL-003 — Engine coherente

Cada `AppliedRule.engineVersion` debe coincidir exactamente con:

- `CanonicalSnapshot.engineVersion`;
- `FinancialSnapshotMetadata.engineVersion`.

### INV-RUL-004 — Orden total

`order` debe ser entero finito, no negativo y único dentro del snapshot.

### INV-RUL-005 — Secuencia sin ambigüedad

La lista debe estar ordenada ascendentemente por `order`. La política inicial recomendada es una secuencia contigua desde cero; queda pendiente confirmar si los valores serán índice o prioridad.

### INV-RUL-006 — No duplicados

No puede repetirse la misma combinación `ruleId + ruleVersion + engineVersion` dentro del mismo snapshot salvo que una versión futura modele ejecuciones múltiples explícitamente.

### INV-RUL-007 — Versión honesta

Si no existe versión formal de regla, `ruleVersion` debe omitirse. Está prohibido inventarla a partir de fechas, commits o versión de aplicación.

### INV-RUL-008 — Limitación explícita

La ausencia de `ruleVersion` debe quedar reflejada en `limitationCodes` hasta que exista Rule Registry formal.

### INV-RUL-009 — Campos afectados

`affectedFields` debe usar identificadores estructurados y estables. No autoriza recomputación ni prueba por sí solo que la regla se ejecutó correctamente.

### INV-RUL-010 — Dataset vacío

Con el adapter actual, incluso un dataset vacío declara `balance.report.current`. Por tanto, un snapshot del motor actual con cero reglas aplicadas es inválido.

### INV-RUL-011 — Sin Rule Registry implícito

`AppliedRule` no contiene código ejecutable, dependencias dinámicas, estados del registro ni implementaciones de reglas.

### INV-RUL-012 — Regla cambiada, revisión nueva

Un cambio material en IDs, versiones, orden semántico o limitaciones aplicables exige nueva revisión.

## 10. Invariantes de SnapshotScope

### INV-SCO-001 — Scope completo

Todo scope debe declarar kind, inicio, fin, política de límite final, `asOf`, timezone, modo, moneda y filtros.

### INV-SCO-002 — Kind soportado

Milestone 3A reconoce:

- `daily`;
- `weekly`;
- `monthly`;
- `season`;
- `year`;
- `custom`.

`trip` permanece reservado y no es un valor válido del contrato actual.

### INV-SCO-003 — Periodo ordenado

`periodStart` no puede ser posterior a `periodEnd` bajo la semántica temporal aprobada.

### INV-SCO-004 — Límite explícito

`periodEndBoundary` siempre debe declarar `inclusive` o `exclusive`. Nunca se infiere por kind, locale o consumidor.

### INV-SCO-005 — Timezone obligatorio

`timezone` no puede estar vacío. Su formato y catálogo deben cerrarse antes del Builder.

### INV-SCO-006 — Modo básico

Si `usageMode = basic`, `earningPeriodId` debe estar ausente.

### INV-SCO-007 — Scope season

Si `kind = season`:

- `usageMode` debe ser `professional`;
- `earningPeriodId` debe existir;
- `earningPeriodId` debe ser entero finito positivo.

### INV-SCO-008 — Periodo profesional opcional

Un scope profesional distinto de `season` puede declarar `earningPeriodId` solo si el consumidor pretende acotar explícitamente ese periodo. No debe añadirse por conveniencia para alterar semánticas legacy.

### INV-SCO-009 — Moneda soportada

`currency` debe pertenecer a `CurrencyCode`. La presencia del código no garantiza que toda evidencia tenga valor resoluble; eso se expresa mediante resultados y advertencias existentes.

### INV-SCO-010 — Filtros estructurados

`filters` solo contiene JSON serializable y campos aprobados. No admite callbacks, queries, expresiones ejecutables ni texto de consulta libre.

### INV-SCO-011 — Filtros materiales

Un filtro que altera inclusión debe formar parte de la key, canonical y reproducción. Un filtro de presentación nunca pertenece al scope financiero.

### INV-SCO-012 — Custom no es ilimitado

`custom` requiere inicio, fin y filtros estructurados explícitos. No autoriza scopes arbitrarios, infinitos o no reproducibles.

### INV-SCO-013 — Scope inmutable

Después del sellado no puede cambiar ninguna dimensión del scope. Un cambio de identidad material produce otra key; un cambio material dentro de la misma key produce una revisión según política aprobada.

## 11. Invariantes temporales

### INV-TIM-001 — Formatos inequívocos

`periodStart`, `periodEnd`, `asOf`, `generatedAt` y `logicalDate` deben usar formatos versionados e inequívocos. El formato exacto sigue pendiente.

### INV-TIM-002 — Zona explícita

Ninguna interpretación depende de la timezone implícita del dispositivo, navegador o servidor.

### INV-TIM-003 — Instante lógico

`asOf` fija el último instante lógico cuya evidencia puede afectar el snapshot. No equivale necesariamente a `generatedAt`.

### INV-TIM-004 — Generación no anterior

`generatedAt` no puede ser anterior a `asOf`, salvo que una política de reloj lógico futura modele explícitamente esa situación. Por defecto, tal combinación es inválida.

### INV-TIM-005 — No evidencia futura

Ningún registro incluido puede tener fecha o instante financiero posterior a `asOf` según la regla temporal aplicable.

### INV-TIM-006 — Pertenencia al periodo

Todo registro incluido debe satisfacer simultáneamente el límite inicial y la política `periodEndBoundary`.

### INV-TIM-007 — Periodo abierto al asOf

Si `periodEnd` se extiende más allá de `asOf`, el snapshot representa únicamente la evidencia disponible hasta `asOf`. Esta condición debe quedar explícita en metadata o calidad futura; no puede aparentar cobertura completa del periodo.

### INV-TIM-008 — Fechas no son timestamps

Un campo de fecha civil no debe convertirse silenciosamente en timestamp UTC. La semántica de cada campo temporal debe estar definida por versión.

### INV-TIM-009 — Cambio de política temporal

Cambiar timezone, primer día de semana, inclusividad, interpretación de fecha o reloj lógico es un cambio material de versión o scope.

### INV-TIM-010 — Reloj no determinista aislado

El reloj del sistema solo puede aportar metadata técnica futura. No debe alterar resultados materiales cuando `asOf` y evidencia son iguales.

### INV-TIM-011 — DST y cambios de offset

Periodos que crucen cambios de horario deben resolverse por la timezone declarada, no por un offset fijo inferido. La política exacta debe probarse antes del Builder.

## 12. Invariantes de auditoría

### INV-AUD-001 — Cadena explicable

Debe poder trazarse:

```text
snapshotId
-> snapshotKey + revision
-> scope + versiones
-> estado financiero
-> reglas aplicadas
-> evidencia incluida/excluida
-> valores históricos utilizados
-> advertencias y limitaciones
```

### INV-AUD-002 — Pregunta financiera reproducible

La evidencia debe permitir responder “¿por qué este balance vale X?” sin IA, narrativa libre ni consulta obligatoria al estado vivo.

### INV-AUD-003 — Procedencia local

En el contrato actual, `FinancialSnapshotMetadata.provenance` debe ser `local`.

### INV-AUD-004 — Versiones completas

La auditoría conserva `snapshotVersion`, canonicalization version, `engineVersion` y versiones formales de reglas cuando existan.

### INV-AUD-005 — Advertencias preservadas

`qualityCodes`, `warningCodes`, `coverageCodes` y `limitationCodes` materiales no se descartan al sellar.

### INV-AUD-006 — No logging como evidencia

Logs, consola y telemetría no sustituyen metadata, reglas o evidencia dentro del contrato.

### INV-AUD-007 — No IA como prueba

Texto generado por un modelo, embeddings o inferencias no constituye evidencia financiera.

### INV-AUD-008 — No datos prohibidos

La auditabilidad no justifica almacenar secretos, credenciales, comunicaciones, notas libres innecesarias o identidad sensible no aprobada.

### INV-AUD-009 — Motivo de revisión

Cada revisión posterior documenta una causa estructurada que pueda relacionarse con el cambio material observado.

### INV-AUD-010 — Historia intacta

La cadena de revisión permite inspeccionar artefactos sustituidos sin reescribirlos.

### INV-AUD-011 — Integridad futura verificable

Cuando exista fingerprint, cualquier auditoría debe poder recalcularlo desde la representación canónica y detectar alteraciones.

### INV-AUD-012 — Autoridad limitada

Un snapshot auditable sigue siendo evidencia derivada. No convierte sus datos en movimientos ni autoriza acciones financieras.

## 13. Invariantes de serialización

### INV-SER-001 — JSON puro

Todos los contratos deben poder representarse mediante JSON sin pérdida semántica bajo la versión aprobada.

### INV-SER-002 — Valores permitidos

Solo se admiten:

- string;
- number finito;
- boolean;
- `null`;
- objetos con claves string;
- arrays de valores permitidos.

### INV-SER-003 — Valores prohibidos

No se admiten:

- `undefined` material;
- `NaN`;
- `Infinity` o `-Infinity`;
- bigint;
- symbol;
- functions;
- `Date` como instancia;
- Map, Set o clases;
- referencias cíclicas;
- prototipos con comportamiento.

### INV-SER-004 — Opcionales omitidos

Un campo opcional ausente se omite. No se serializa como `undefined`. La diferencia frente a `null` debe estar definida por versión.

### INV-SER-005 — Arrays readonly

La serialización conserva contenido y orden semántico aprobado. No puede ordenar in-place una colección recibida.

### INV-SER-006 — Números

Todo número debe ser finito. Conteos, revisiones, IDs numéricos y órdenes que conceptualmente sean enteros no admiten decimales.

### INV-SER-007 — Strings estructurados

IDs, versiones, códigos, moneda, timezone y fechas no pueden depender de traducciones o locale.

### INV-SER-008 — Serialización no es canonicalización

Dos JSON equivalentes pueden tener orden de claves distinto. Hasta Milestone de canonicalización, serializar no autoriza afirmar igualdad canónica ni calcular fingerprint.

### INV-SER-009 — Metadata volátil separable

La futura representación canónica debe poder excluir campos volátiles sin alterar el objeto original ni perder auditoría operacional.

### INV-SER-010 — Round trip

Una futura prueba de contrato deberá demostrar que serializar y deserializar preserva exactamente el significado del modelo soportado.

### INV-SER-011 — Tamaño no altera semántica

Límites futuros de almacenamiento o transporte no pueden truncar evidencia silenciosamente. Un exceso de tamaño produce fallo explícito.

## 14. Invariantes para futuras revisiones

### INV-FUT-001 — Nuevos campos

Agregar un campo exige clasificarlo como material, auditivo u operacional antes de decidir versión y fingerprint.

### INV-FUT-002 — Campos materiales

Un nuevo campo material requiere revisar:

- `SnapshotVersion`;
- evidencia necesaria;
- canonicalización;
- fingerprint;
- comparabilidad;
- reproducción;
- privacidad.

### INV-FUT-003 — Campos opcionales

Opcional no significa semánticamente irrelevante. Debe definirse el significado de ausencia y compatibilidad.

### INV-FUT-004 — Nuevas fuentes

Agregar una fuente distinta de income/expense exige demostrar que Financial Engine la consume y aprobar una nueva versión. No puede añadirse solo para anticipar capas futuras.

### INV-FUT-005 — Nuevos scopes

Agregar `trip` u otro kind requiere entidad canónica, reglas de pertenencia, identidad, periodo y pruebas. Nunca se infiere desde ciudad o notas.

### INV-FUT-006 — Cambio de Engine

Una nueva versión del motor no reescribe snapshots anteriores. Su resultado produce una revisión nueva cuando se reconstruye el mismo ámbito.

### INV-FUT-007 — Rule Registry futuro

Versiones formales de reglas enriquecen nuevas revisiones. No se insertan retroactivamente en snapshots antiguos.

### INV-FUT-008 — Fingerprint futuro

El algoritmo elegido no modifica contenido histórico. Cambiar algoritmo o dominio de huella exige versión y política de compatibilidad.

### INV-FUT-009 — Persistencia futura

Persistir no altera los invariantes. El repositorio deberá rechazar artefactos inválidos y nunca normalizarlos silenciosamente.

### INV-FUT-010 — Migraciones

Una migración no edita contenido sellado para hacerlo parecer nativo de una versión nueva. Debe conservar el original y crear una proyección o revisión explícita.

### INV-FUT-011 — Backup y restore

Una futura restauración preserva identidad, cadena, versiones y evidencia. Colisiones o referencias faltantes producen conflicto explícito.

### INV-FUT-012 — Eliminación y retención

No se podrá borrar una revisión requerida por otra, por auditoría o reproducción sin política aprobada y evidencia de la decisión.

### INV-FUT-013 — Sin promoción global

La incorporación de snapshots a un consumidor no autoriza otros consumidores. Cada promoción mantiene fallback y criterios propios.

## 15. Casos inválidos

Los siguientes ejemplos son inválidos aunque TypeScript permita representarlos estructuralmente:

### 15.1 Identidad y revisión

- `snapshotId` vacío.
- `snapshotKey` vacío.
- `revision = 0`, negativa, decimal, `NaN` o infinita.
- revisión `1` con `supersedesSnapshotId`.
- revisión `2` sin predecesora.
- predecesora con otra key.
- dos revisiones activas con el mismo número.
- reutilizar un `snapshotId` con contenido distinto.

### 15.2 Versiones

- `snapshotVersion` vacía o desconocida.
- versiones distintas entre input, metadata y canonical.
- `canonicalizationVersion` distinta entre canonical, metadata y fingerprint.
- `engineVersion` distinta entre metadata, canonical y AppliedRule.
- cambiar significado sin incrementar versión.
- inventar `ruleVersion` inexistente.

### 15.3 Estados

- `requested` con fingerprint presentado como definitivo.
- `building` publicado como evidencia.
- `failed -> sealed` sobre el mismo candidato.
- `sealed -> validated`.
- `published` sin persistencia en el flujo aprobado.
- `superseded` sin revisión sucesora.
- `invalidated -> published` in-place.

### 15.4 Evidencia

- conteos negativos o decimales.
- `candidate != included + excluded`.
- registro excluded sin código.
- registro included con código de exclusión.
- referencia mutable a una fila viva de Dexie.
- evidencia referenciada sin fingerprint futuro.
- incluir `undefined`, `NaN`, Infinity o Date.
- usar tasa actual en lugar del valor histórico almacenado.
- mezclar modos sin aplicar la regla existente.
- convertir un ajuste en ingreso o gasto normal.
- incluir secretos o datos WhatsApp.
- truncar evidencia por tamaño sin fallo.

### 15.5 Scope y tiempo

- `periodStart > periodEnd`.
- `periodEndBoundary` ausente.
- timezone vacía o implícita.
- modo basic con `earningPeriodId`.
- kind season en modo basic.
- kind season sin `earningPeriodId`.
- `trip` en la versión actual.
- registro incluido fuera del periodo.
- evidencia posterior a `asOf`.
- `generatedAt < asOf` sin política explícita.
- filtro ejecutable o dependiente de UI.

### 15.6 Auditoría

- resultado sin reglas aplicadas bajo el engine actual.
- logs usados como única explicación.
- narrativa de IA usada como evidencia.
- snapshot que solo guarda totales y no permite reproducción.
- snapshot que requiere consultar Neon o estado vivo para explicarse.

## 16. Casos límite

### 16.1 Dataset vacío

Es válido si:

- conteos son cero;
- no hay evidencia incluida;
- Financial Engine produce su resultado vacío caracterizado;
- `balance.report.current` permanece declarado por el engine actual;
- el scope sigue completo.

Cero registros no equivale a scope ausente.

### 16.2 Valores financieros cero

Cero es un valor válido y no debe confundirse con dato ausente, moneda no resoluble o evidencia incompleta.

### 16.3 Moneda no resoluble

Debe preservar el comportamiento caracterizado del Financial Engine y advertencias correspondientes. No autoriza conversión nueva.

### 16.4 Registros legacy sin usageMode

Su pertenencia se decide exclusivamente mediante la regla existente de resolución de modo. El snapshot conserva la evidencia material y limitaciones.

### 16.5 Registros sin sourceId

No se descartan automáticamente. Deben esperar una política de identidad/desempate reproducible antes de canonicalización y fingerprint.

### 16.6 Duplicados materiales

Dos registros materialmente iguales no se colapsan por deduplicación incidental. Solo una identidad o regla aprobada puede declarar duplicidad.

### 16.7 Ajustes negativos

Se conserva signo, clasificación e impacto existentes. Canonicalización futura no puede normalizarlos como positivos.

### 16.8 Periodo de un solo día

Puede tener inicio y fin iguales cuando la política de límite permita representar al menos un intervalo válido.

### 16.9 Periodo parcialmente transcurrido

Es válido con `asOf` anterior al final nominal si queda declarado como cobertura parcial y no incluye evidencia futura.

### 16.10 Cambio horario

El mismo periodo civil puede tener duración distinta de 24 horas. No debe corregirse usando offset fijo.

### 16.11 Misma evidencia en distinto orden

Debe considerarse semánticamente equivalente cuando el orden no tenga significado. La garantía de bytes iguales pertenece al milestone de canonicalización.

### 16.12 Mismo resultado, reglas distintas

No son snapshots equivalentes. AppliedRules y versiones forman parte del significado material.

### 16.13 Misma evidencia, versión nueva del motor

Debe producir nueva revisión si se reconstruye. Igual resultado numérico no permite reutilizar metadata anterior.

### 16.14 Metadata técnica distinta

Dos generaciones con mismo contenido material pero distinto `generatedAt` no deberían crear revisiones distintas únicamente por ese campo. La deduplicación exacta queda para fingerprint futuro.

### 16.15 Evidencia referenciada no disponible

El artefacto puede conservarse, pero no reproducirse ni publicarse como válido hasta recuperar y verificar la evidencia.

### 16.16 Snapshot invalidado con sucesor

El invalidado se conserva y el sucesor explica la corrección. No se elimina ni se modifica.

## 17. Checklist previo a Snapshot Builder

Snapshot Builder NO debe comenzar hasta completar esta lista.

### 17.1 Contrato y estados

- [ ] Decidir separación entre candidato, ejecución y snapshot sellado.
- [ ] Definir cuáles estados pertenecen a cada contrato.
- [ ] Confirmar flujo de estados y transiciones terminales.
- [ ] Definir catálogo de motivos de revisión.
- [ ] Confirmar numeración inicial y política ante bifurcaciones.

### 17.2 Identidad

- [ ] Definir formato de `snapshotId`.
- [ ] Definir composición y encoding de `snapshotKey`.
- [ ] Definir sujeto local autorizado sin datos sensibles.
- [ ] Definir identidad para registros legacy sin ID.
- [ ] Probar que cambios de scope material cambian la key.

### 17.3 Scope y tiempo

- [ ] Definir formato de fecha y timestamp.
- [ ] Definir catálogo/formato de timezone.
- [ ] Definir semántica exacta de `asOf`.
- [ ] Definir inclusividad de inicio y fin.
- [ ] Definir semana y primer día.
- [ ] Definir comportamiento DST.
- [ ] Definir cobertura parcial.
- [ ] Confirmar que `trip` continúa prohibido.

### 17.4 Evidencia

- [ ] Inventariar campos exactos consumidos por Financial Engine.
- [ ] Definir schema de materialFields por fuente y versión.
- [ ] Definir universo candidato y exclusiones.
- [ ] Elegir evidencia embebida o referenciada para la primera versión.
- [ ] Definir códigos de exclusión, cobertura y advertencia.
- [ ] Probar conteos y modos.
- [ ] Verificar que no se almacenan campos sensibles.
- [ ] Definir vista local coherente sin modificar Dexie.

### 17.5 Reglas y versiones

- [ ] Congelar `SnapshotVersion` inicial.
- [ ] Definir formato de versiones.
- [ ] Confirmar mapeo exacto de AppliedRule desde Financial Engine.
- [ ] Definir limitation code para ruleVersion ausente.
- [ ] Confirmar semántica de `order`.
- [ ] Definir matriz inicial de compatibilidad.

### 17.6 Serialización

- [ ] Definir representación de opcionales y null.
- [ ] Rechazar números no finitos.
- [ ] Definir representación de dinero sin regla nueva.
- [ ] Definir round trip JSON.
- [ ] Asegurar ausencia de clases y prototipos.
- [ ] Definir límites de tamaño con fallo explícito.

### 17.7 Límites de fase

- [ ] Builder será in-memory y sin persistencia.
- [ ] Builder no contendrá fórmulas financieras.
- [ ] Builder no llamará red, Neon, n8n o Automation Gateway.
- [ ] Builder no modificará Financial Engine.
- [ ] Builder no modificará inputs.
- [ ] No se implementará canonicalización dentro del Builder inicial.
- [ ] No se implementará fingerprint dentro del Builder inicial.
- [ ] No se conectará ningún consumidor.
- [ ] No se añadirá Shadow Mode ni Promotion Policy.

### 17.8 Pruebas futuras obligatorias

- [ ] Dataset vacío.
- [ ] Solo ingresos y solo gastos.
- [ ] Ajustes positivos y negativos.
- [ ] Modo básico y profesional.
- [ ] Temporada concreta.
- [ ] Valores históricos de moneda.
- [ ] Duración efectiva.
- [ ] Datos legacy incompletos.
- [ ] Entradas readonly congeladas.
- [ ] Evidencia incluida y excluida.
- [ ] Conteos inconsistentes rechazados.
- [ ] Versiones incompatibles rechazadas.
- [ ] Scope temporal inválido rechazado.
- [ ] Cero escrituras y cero red.

## 18. Riesgos detectados

### 18.1 Contrato único para estados incompatibles

El modelo actual permite estados transitorios y definitivos en la misma forma `FinancialSnapshot`, mientras canonical y fingerprint son obligatorios. Sin discriminación futura pueden construirse combinaciones lógicamente imposibles.

### 18.2 FinancialEvidence demasiado abierto

`materialFields` es JSON tipado pero no tiene schema por fuente. Sin congelar una primera versión puede omitirse evidencia material o incluirse información sensible.

### 18.3 Identidad legacy

Los registros pueden carecer de ID estable. Sin desempate aprobado no existe orden canónico seguro ni identidad de evidencia durable.

### 18.4 Versiones de reglas ausentes

El engine actual declara IDs y engineVersion, pero no versiones formales de regla. La reproducibilidad histórica queda limitada a runtimes compatibles hasta formalizar esa dimensión.

### 18.5 Temporalidad ambigua

Strings temporalmente tipados no garantizan formato, timezone ni semántica. El Builder no debe empezar hasta cerrar estas reglas.

### 18.6 Evidencia referenciada

El modelo permite referencia y fingerprint opcionales. Sin unión discriminada puede confundirse evidencia embebida, parcial o externa.

### 18.7 Invariantes no ejecutables todavía

Documentar reglas no impide crear objetos inválidos. La futura validación debe ser explícita, pero no pertenece a este milestone.

### 18.8 Duplicación de versiones

Snapshot y metadata repiten versiones. Esto mejora auditoría, pero requiere validación estricta de igualdad para evitar drift.

## 19. Decisiones abiertas

Quedan pendientes antes de Snapshot Builder:

1. Separar `SnapshotCandidate`, ejecución y `FinancialSnapshot` sellado o usar unión discriminada.
2. Definir formato y catálogo de `SnapshotVersion`.
3. Definir formato de IDs y composición de snapshot key.
4. Definir inicio de revisión y política de bifurcaciones; este documento propone secuencia desde 1 sin ramas por defecto.
5. Definir schema versionado de `materialFields` para income y expense.
6. Elegir estrategia inicial de evidencia embebida o referenciada.
7. Definir identidad/desempate para registros sin ID.
8. Confirmar si `AppliedRule.order` es índice contiguo desde cero.
9. Definir formatos temporales, timezone y `asOf`.
10. Definir semántica de periodos parciales.
11. Definir catálogos de motivos, exclusión, cobertura, calidad, warning y limitación.
12. Definir representación JSON de opcionales, null y dinero.
13. Definir qué metadata operacional vive fuera del contenido sellado.
14. Definir si publicación exige siempre persistencia local en todas las versiones futuras.
15. Definir política de comparabilidad y reconstrucción entre versiones.

Las decisiones de algoritmo de canonicalización, fingerprint, persistencia, Shadow Mode y promoción siguen aplazadas a sus milestones correspondientes.

## 20. Criterio de cierre de Milestone 3A.5

Milestone 3A.5 queda arquitectónicamente completo cuando:

- los invariantes están documentados y trazables;
- no existe comportamiento ejecutable añadido;
- no se modifican contratos 3A, Financial Engine ni consumidores;
- riesgos y decisiones abiertas son explícitos;
- el checklist bloquea el inicio prematuro del Builder;
- `git diff --check` no detecta errores;
- el único cambio del milestone es este documento.

Este documento no declara que los invariantes se cumplan en runtime. Declara las condiciones que una implementación futura deberá demostrar.

## Addendum — Canonicalization V2 Material Idempotence

Milestone 4D cierra los siguientes invariantes adicionales para snapshots mensuales V2:

- La metadata operacional (`generatedAt`, `sealedAt`, `persistedAt`, `sourceScopeAsOf`, IDs de ejecución o candidato) NO DEBE alterar el fingerprint material.
- En canonicalization V2 mensual, el `asOf` observado de render NO DEBE pertenecer al scope material fingerprinted; debe conservarse únicamente como metadata operacional verificable.
- Dos ejecuciones con mismo contenido financiero material y distinta metadata operacional DEBEN conservar el mismo fingerprint V2 y el mismo `snapshotId`.
- Snapshots V1 siguen siendo legibles y verificables, pero esa compatibilidad no obliga a declararlos elegibles para promoción.

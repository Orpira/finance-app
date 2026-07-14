# 12 — Financial Snapshot Normative Decisions

> **DECISIONES NORMATIVAS PREVIAS A SNAPSHOT BUILDER**
>
> Este documento cierra exclusivamente las decisiones que bloquean el diseño de Snapshot Builder. No implementa Builder, modelos, canonicalización, fingerprint, persistencia, servicios, consumidores ni infraestructura.

## 1. Estado, alcance y autoridad

- **Tipo:** especificación normativa de decisiones de dominio.
- **Milestone:** cierre de decisiones previo a Financial Snapshot Builder.
- **Estado:** aprobado para orientar la siguiente fase, pendiente de formalización posterior en ADRs cuando corresponda.
- **Estado runtime:** no implementado.
- **Autoridad superior:** `PRIVATE_BALANCE_CONSTITUTION.md` y ADRs aceptadas en `DECISIONS.md`.
- **Arquitectura marco:** `09_AI_CORE_ARCHITECTURE.md`.
- **Especificación del componente:** `10_FINANCIAL_SNAPSHOT_ARCHITECTURE.md`.
- **Invariantes obligatorios:** `11_FINANCIAL_SNAPSHOT_INVARIANTS.md`.
- **Modelo 3A inspeccionado:** `src/types/financialSnapshot.ts`.

Este documento no modifica `DECISIONS.md` ni crea ADRs separados. Si una futura ADR contradice una decisión aquí descrita, deberá explicar explícitamente la migración y el impacto sobre snapshots existentes.

### 1.1 Convenciones

- **DECIDIDO:** bloqueante cerrado para la siguiente fase.
- **POSPUESTO:** no bloquea Builder y pertenece a una fase posterior.
- **PROHIBIDO EN V1:** alternativa evaluada que no puede usarse en la primera versión.
- **COMPATIBLE:** puede coexistir sin reinterpretar historia.
- **INCOMPATIBLE:** requiere nueva versión, reconstrucción o rechazo explícito.

### 1.2 Regla de no implementación

Los formatos y contratos descritos son normativos, pero todavía no existen como validadores, funciones, clases o servicios. El siguiente milestone deberá materializar únicamente la porción autorizada.

## 2. Resumen ejecutivo de decisiones cerradas

| Tema | Decisión v1 |
| --- | --- |
| Artefactos | Separar ejecución, candidato y snapshot sellado |
| Evidencia | Embebida y local |
| Periodos | Intervalos semiabiertos `[start, end)` |
| Fechas civiles | `YYYY-MM-DD` |
| Instantes | RFC 3339 UTC con milisegundos |
| Timezone | Identificador IANA explícito |
| Dinero | JSON number finito, sin redondeo nuevo |
| Opcionales | Ausencia significa no aplicable/no disponible; `null` prohibido por defecto |
| Legacy sin ID | Identidad content-addressed; duplicados como multiset |
| Revisión | Entero positivo desde 1, secuencia lineal |
| AppliedRule.order | Índice de declaración base cero, contiguo |
| Scope inicial | daily, weekly, monthly, season, year, custom |
| Fuentes financieras v1 | income y expense; ajuste como clasificación de una de ellas |
| Citas | No son evidencia financiera v1 hasta convertirse en ingreso |
| Temporada/settings | Contexto del scope, no movimientos ni registros de evidencia |
| Regla temporal | `asOf` limita evidencia aunque el periodo nominal continúe |
| Versiones | Namespaces explícitos; engineVersion se conserva verbatim |
| Rule set inicial | Identidad ligada al bundle del engine, sin inventar ruleVersion |

## 3. Separación formal de artefactos

### 3.1 Decisión

Se separan tres conceptos sin herencia conductual ni estado compartido mutable:

```text
SnapshotBuildExecution
    coordina y documenta un intento
            │
            ▼
SnapshotCandidate
    contiene evidencia y resultado aún no sellados
            │ fase futura de canonicalización + fingerprint
            ▼
SealedFinancialSnapshot
    evidencia final inmutable y versionada
```

El nombre actual `FinancialSnapshot` del modelo 3A representa demasiadas etapas a la vez. Antes de implementar Builder deberá refinarse para reflejar esta separación. Esta decisión no modifica el archivo de tipos en el presente milestone.

### 3.2 `SnapshotBuildExecution`

Representa un intento operacional de construir un candidato.

Responsabilidades permitidas:

- identificar el intento;
- referenciar el input solicitado;
- registrar estado operacional;
- registrar inicio y finalización;
- referenciar el candidato resultante si existe;
- conservar códigos técnicos de fallo sin payload financiero sensible.

No es evidencia financiera, no pertenece a la cadena de revisiones y no contiene canonical payload o fingerprint.

Campos conceptuales mínimos:

- `executionId`;
- `status`;
- `requestedAt`;
- `startedAt` opcional;
- `finishedAt` opcional;
- `candidateId` opcional;
- `failureCode` opcional;
- `snapshotVersionRequested`;
- referencia o copia inmutable del input no sensible.

### 3.3 `SnapshotCandidate`

Representa la salida in-memory de Builder antes de canonicalización y sellado.

Responsabilidades permitidas:

- scope validado;
- evidencia embebida validada estructuralmente;
- resultado exacto recibido de Financial Engine;
- `engineVersion` real;
- `rulesetVersion` derivada del bundle del engine;
- AppliedRules declaradas por el engine;
- warnings, quality y limitation codes;
- versiones solicitadas todavía no selladas;
- metadata de generación del candidato.

No tiene identidad final, revisión final, canonical payload, fingerprint ni `sealedAt`.

### 3.4 `SealedFinancialSnapshot`

Representa el único artefacto que puede llamarse snapshot financiero definitivo.

Responsabilidades:

- identidad final;
- revisión final;
- versiones definitivas;
- canonical payload;
- fingerprint;
- `sealedAt`;
- contenido financiero inmutable;
- evidencia inmutable;
- AppliedRules inmutables;
- relación append-only con la revisión anterior.

Solo una fase futura de sellado podrá producirlo. Snapshot Builder por sí solo produce candidatos, no snapshots sellados.

### 3.5 Razón de la separación

La separación evita:

- fingerprints en estados `requested` o `building`;
- identidad final sobre contenido todavía mutable;
- revisiones asignadas a intentos fallidos;
- estados operacionales dentro del contenido financiero;
- confundir validación estructural con integridad canónica;
- persistir candidatos como si fueran evidencia definitiva.

## 4. Estados permitidos por artefacto

### 4.1 Estados de `SnapshotBuildExecution`

Estados normativos:

```text
requested -> running -> succeeded
                    └-> failed
requested ----------> cancelled
running ------------> cancelled
```

Semántica:

- `requested`: intento registrado, todavía no iniciado.
- `running`: Builder está procesando el input.
- `succeeded`: existe exactamente un `SnapshotCandidate` asociado.
- `failed`: no existe candidato válido; debe existir `failureCode`.
- `cancelled`: no debe producir candidato después de la cancelación.

`succeeded`, `failed` y `cancelled` son terminales.

### 4.2 Estados de `SnapshotCandidate`

Estados normativos:

```text
draft -> validated
     └-> rejected
validated -> rejected
```

Semántica:

- `draft`: resultado ensamblado pero invariantes todavía no confirmados.
- `validated`: cumple invariantes exigibles antes de canonicalización.
- `rejected`: no puede avanzar; conserva códigos de rechazo técnicos.

Solo `validated` podrá entregarse a una fase futura de canonicalización. No existe transición de vuelta a `draft`.

### 4.3 Estados de `SealedFinancialSnapshot`

Estados normativos:

```text
sealed -> persisted -> published -> superseded
   │          │           │
   └----------┴-----------┴-> invalidated
```

Semántica:

- `sealed`: canonical payload y fingerprint completos; aún no implica almacenamiento.
- `persisted`: guardado localmente y verificado en una fase futura.
- `published`: admitido para capas posteriores aprobadas; no significa sincronizado.
- `superseded`: sustituido por una revisión posterior válida.
- `invalidated`: no consumible por corrupción, incompatibilidad o evidencia insuficiente descubierta.

No existen retrocesos ni rehabilitación in-place.

### 4.4 Relación con `SnapshotStatus` actual

La unión actual `SnapshotStatus` mezcla los tres ciclos de vida. Antes de Builder deberá sustituirse o dividirse en tipos discriminados equivalentes a:

- `SnapshotBuildExecutionStatus`;
- `SnapshotCandidateStatus`;
- `SealedFinancialSnapshotStatus`.

No se mantendrá una unión única si permite combinaciones inválidas.

## 5. Campos exclusivos del snapshot sellado

Los siguientes campos PROHIBIDOS en ejecución y candidato solo aparecen en `SealedFinancialSnapshot`:

### 5.1 Canonical payload

- Es la representación material normalizada.
- No existe hasta completar canonicalización.
- No es equivalente a serializar el candidato.
- Es inmutable.

### 5.2 Fingerprint

- Se calcula exclusivamente sobre el canonical payload y dominio versionado.
- No puede ser placeholder, string vacío ni hash del JSON incidental del candidato.
- No existe durante Builder.

### 5.3 `sealedAt`

- Instante UTC en que se completó sellado.
- No es `requestedAt`, `generatedAt` ni `finishedAt` de la ejecución.
- No forma parte del contenido financiero material salvo decisión expresa de la versión de canonicalización.

### 5.4 Revisión final

- Se asigna al sellar dentro de una cadena lógica.
- Un candidato no puede reservar revisiones definitivas.
- Un intento fallido no consume revisión.

### 5.5 Versiones definitivas

Solo al sellar quedan fijadas:

- `snapshotVersion`;
- `canonicalizationVersion`;
- `engineVersion`;
- `rulesetVersion`;
- `fingerprintVersion` futura.

El candidato conserva versiones solicitadas y observadas, pero no las declara como identidad histórica definitiva.

### 5.6 Identidad final

`snapshotId` y `snapshotKey` definitivos pertenecen al snapshot sellado. Execution y Candidate usan IDs propios sin semántica financiera histórica.

## 6. Formatos normativos de identidad y versión

### 6.1 Reglas generales

- ASCII únicamente.
- Minúsculas salvo `engineVersion`, que se conserva verbatim.
- Sin espacios.
- Sin información personal o financiera legible.
- Sin timestamps concatenados como mecanismo de unicidad.
- Sin dependencia del orden de Dexie o del dispositivo.

### 6.2 `executionId`

Formato:

```text
pbsx_<uuid-v7-lowercase>
```

Ejemplo ilustrativo:

```text
pbsx_019f5abc-1234-7def-8abc-1234567890ab
```

El prefijo distingue ejecución de artefactos financieros. La elección UUID v7 aporta unicidad y orden temporal técnico sin convertirlo en fecha financiera.

### 6.3 `candidateId`

Formato:

```text
pbsc_<uuid-v7-lowercase>
```

No se reutiliza como `snapshotId`.

### 6.4 `snapshotId`

Formato normativo:

```text
pbsnap_<uuid-v7-lowercase>
```

Propiedades:

- único por revisión sellada;
- opaco;
- no derivado de datos financieros;
- no reutilizable;
- no cambia al persistir o publicar.

### 6.5 `snapshotKey`

Formato normativo futuro:

```text
pbsk:v1:<scope-kind>:<identity-digest>
```

Donde:

- `scope-kind` usa el valor normativo del scope;
- `identity-digest` es lowercase hex de 64 caracteres;
- el preimage contiene exclusivamente dimensiones materiales de identidad;
- el digest y su preimage se definirán en canonicalización;
- Builder no genera `snapshotKey` definitiva.

Ejemplo ilustrativo:

```text
pbsk:v1:monthly:8d3f...<64 hex>
```

Dimensiones del preimage:

- scope kind;
- periodStart;
- periodEnd;
- política `[start, end)`;
- timezone;
- usageMode;
- currency;
- earningPeriodId cuando aplique;
- filtros materiales;
- sujeto local seudónimo cuando se apruebe.

No participan engine, ruleset, snapshotVersion, revisión o estado. Sus cambios producen revisiones de la misma key cuando el ámbito lógico no cambia.

### 6.6 `revision`

Formato:

- JSON number entero positivo;
- primera revisión `1`;
- siguiente revisión `N + 1`;
- sin huecos por defecto;
- sin ceros iniciales al representarla como texto;
- una cadena lineal por snapshotKey.

Un intento o candidato no consume revisión.

### 6.7 `snapshotVersion`

Formato:

```text
financial-snapshot/<semver>
```

Versión inicial planificada:

```text
financial-snapshot/1.0.0
```

Semántica:

- MAJOR: cambio incompatible de significado o schema material.
- MINOR: adición compatible que lectores anteriores pueden ignorar sin alterar significado existente.
- PATCH: aclaración o corrección no material sin cambio de canonical payload.

### 6.8 `canonicalizationVersion`

Formato:

```text
financial-snapshot-c14n/<semver>
```

Versión inicial reservada:

```text
financial-snapshot-c14n/1.0.0
```

Reservar el identificador no implementa canonicalización.

### 6.9 `engineVersion`

Se conserva exactamente como la devuelve Financial Engine. No se normaliza, recorta, cambia de case ni transforma a otro semver.

Valor actual observado:

```text
1.0.0-phase-1a-minimal
```

La ausencia o string vacío invalida el candidato.

### 6.10 `rulesetVersion`

Mientras no exista Rule Registry, representa el conjunto de reglas embebido en una versión concreta del engine.

Formato provisional normativo:

```text
engine-bundled/<engineVersion-verbatim>
```

Valor inicial:

```text
engine-bundled/1.0.0-phase-1a-minimal
```

No afirma que cada regla tenga versión individual. `AppliedRule.ruleVersion` seguirá ausente y deberá incluir la limitación normativa correspondiente.

### 6.11 Coherencia de versiones

En un snapshot sellado:

- todas las copias de `snapshotVersion` coinciden;
- todas las copias de `canonicalizationVersion` coinciden;
- todas las AppliedRules usan el mismo `engineVersion` del snapshot;
- `rulesetVersion` corresponde exactamente al engine observado;
- ninguna versión se infiere desde app version o fecha.

## 7. Identidad canónica para registros legacy sin ID

### 7.1 Decisión

Se adopta identidad **content-addressed por proyección material**, no un ID inventado mutable.

Para un registro con ID persistido:

```text
<source>:id:<id-exacto>
```

Para un registro legacy sin ID:

```text
<source>:legacy-v1:<material-digest>
```

El digest solo podrá calcularse en la fase de canonicalización. Snapshot Builder deberá conservar el preimage material completo y marcar `legacy.id.unavailable`.

### 7.2 Estabilidad

La identidad legacy es estable si y solo si no cambian campos materiales. Un cambio material produce otra identidad de evidencia y una revisión nueva.

No intenta mantener identidad de entidad ante una edición: identifica la evidencia observada, no una fila eterna.

### 7.3 Duplicados y colisiones semánticas

Dos registros sin ID con proyección material idéntica obtienen el mismo material digest. No se asignará ordinal basado en orden de lectura.

Se representarán como multiset:

```text
legacyRecordKey + occurrenceCount
```

Builder conserva cada ocurrencia. La canonicalización futura podrá agruparlas de forma determinista. Dos ocurrencias materialmente idénticas siguen contribuyendo dos veces al cálculo.

### 7.4 Colisiones criptográficas futuras

Una colisión de digest entre preimages distintos debe producir error de integridad; nunca deduplicación. El algoritmo concreto se decide con canonicalización/fingerprint, pero deberá conservar o permitir verificar el preimage.

### 7.5 Campos materiales de identidad: income

Participan solo campos consumidos por el engine o necesarios para reproducir su salida:

- `date`;
- tipo financiero resuelto;
- `usageMode` original cuando existe;
- `earningPeriodId`;
- `seasonPeriodId`;
- `duration`;
- `actualDuration` cuando existe;
- `currency`;
- `baseCurrency` y `baseCurrencyValue` cuando existen;
- `secondaryCurrency` y `secondaryCurrencyValue` cuando existen;
- `eurValue`;
- `copValue`;
- label financiero efectivo cuando afecte la salida estructurada de ajustes.

### 7.6 Campos materiales de identidad: expense

Participan:

- `date`;
- `type`;
- `usageMode` original cuando existe;
- `earningPeriodId`;
- `seasonPeriodId`;
- `currency`;
- `baseCurrency` y `baseCurrencyValue` cuando existen;
- `secondaryCurrency` y `secondaryCurrencyValue` cuando existen;
- `eurValue`;
- `copValue`;
- categoría o label financiero efectivo cuando afecte la salida estructurada de ajustes.

### 7.7 Label financiero y privacidad

Las notas libres completas quedan excluidas. Cuando la salida actual del engine usa una nota recortada como label de ajuste, v1 conservará únicamente `effectiveFinancialLabel`, exactamente como se refleja en el resultado financiero.

Este campo:

- es material para reproducción estructural;
- permanece local;
- no se sincroniza ni loguea;
- debe marcar `privacy.sensitive_label.present`;
- no puede usarse para inferir cliente, identidad o conocimiento.

### 7.8 Campos excluidos de identidad legacy

Quedan excluidos salvo que Financial Engine cambie mediante iniciativa separada:

- `createdAt`;
- report status y `reportedAt`;
- timer timestamps y timer status;
- WhatsApp notification timestamps;
- country y city;
- paymentType;
- durationLabel;
- notas libres completas;
- IDs de relación no consumidos;
- UI state;
- backup metadata;
- device o user identifiers;
- cualquier secreto o canal.

### 7.9 Riesgo residual

Sin IDs persistidos no puede demostrarse identidad de entidad a través de ediciones. La estrategia garantiza identidad de evidencia, que es suficiente para reproducción, pero no reemplaza una identidad operativa futura.

## 8. Representación normativa de fechas y tiempo

### 8.1 Categorías temporales

Se distinguen dos tipos semánticos aunque inicialmente sean strings TypeScript:

1. **fecha civil local:** `YYYY-MM-DD`;
2. **instante absoluto:** RFC 3339 UTC con milisegundos.

No son intercambiables.

### 8.2 Fechas civiles

Formato exacto:

```text
YYYY-MM-DD
```

Aplicable a:

- `periodStart`;
- `periodEnd`;
- `FinancialEvidenceRecord.logicalDate`.

Debe representar una fecha válida del calendario gregoriano. No se permiten timestamps, offsets, formatos locales ni fechas imposibles.

### 8.3 Instantes absolutos

Formato exacto:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

Aplicable a:

- `asOf`;
- `requestedAt`;
- `startedAt`;
- `finishedAt`;
- `generatedAt`;
- `sealedAt`.

Todos se almacenan en UTC. El offset original no se conserva como sustituto de timezone del scope.

### 8.4 Timezone

`timezone` usa un identificador IANA case-sensitive, por ejemplo:

```text
Europe/Madrid
America/Bogota
```

Se prohíben:

- abreviaturas como `CET` o `EST`;
- offset fijo como `+02:00`;
- timezone implícita del dispositivo;
- string vacío.

La validación contra catálogo IANA pertenece a Builder validation, no a este documento.

### 8.5 Semántica del periodo

V1 adopta exclusivamente intervalo semiabierto:

```text
[periodStart, periodEnd)
```

Consecuencias:

- inicio inclusivo;
- final exclusivo;
- `periodEndBoundary` v1 debe ser `exclusive`;
- un día se expresa desde D hasta D+1;
- un mes se expresa desde el primer día hasta el primer día del mes siguiente;
- se eliminan ambigüedades de último milisegundo.

`inclusive` permanece en el tipo 3A por compatibilidad de diseño, pero está PROHIBIDO EN V1 y deberá rechazarse antes de construir candidato.

### 8.6 `asOf`

`asOf` es el instante lógico máximo de evidencia observable.

- Ninguna evidencia posterior puede incluirse.
- Si `asOf` ocurre antes del final nominal, la cobertura es parcial.
- Si `asOf` ocurre después del final nominal, no amplía el periodo.
- El límite efectivo es la intersección del periodo civil con `asOf`.
- No se obtiene implícitamente durante serialización o render.

### 8.7 Relación temporal obligatoria

Debe cumplirse:

```text
requestedAt <= startedAt <= finishedAt
generatedAt <= finishedAt
asOf <= generatedAt
generatedAt <= sealedAt
```

Los campos opcionales solo participan cuando existen. Desviaciones de reloj producen fallo; no se corrigen silenciosamente.

### 8.8 DST

Los límites civiles se resuelven mediante la timezone IANA. Un día puede durar 23 o 25 horas. Nunca se asume duración fija de 24 horas para pertenencia civil.

### 8.9 Semana normativa

Para `weekly`, v1 adopta ISO week:

- lunes como primer día;
- periodo `[lunes, lunes siguiente)`;
- numeración ISO 8601 cuando se muestre una etiqueta;
- timezone del scope para resolver límites.

### 8.10 Scope season y custom

- `season` usa fechas explícitas del scope y `earningPeriodId` obligatorio.
- `custom` usa fechas explícitas, no nombres relativos como “últimos 30 días”.
- ningún scope almacena expresiones temporales dinámicas.

## 9. Representación normativa de dinero

### 9.1 Decisión v1

V1 conserva dinero como **JSON number finito**, exactamente compatible con los valores almacenados y resultados actuales de Financial Engine.

No se adoptan strings decimales en Builder v1 porque convertir entre number y string podría introducir una nueva política de precisión o redondeo no presente en AI Foundation.

### 9.2 Reglas

- Solo números finitos.
- `NaN`, Infinity y `-Infinity` son inválidos.
- No se acepta notación monetaria formateada.
- No se incluyen separadores de miles ni símbolos.
- La moneda se declara separadamente mediante `CurrencyCode`.
- Un valor monetario nunca se interpreta sin contexto de moneda.

### 9.3 Precisión

La precisión es la que produce o consume actualmente Financial Engine. Snapshot Builder:

- no redondea;
- no trunca;
- no cambia escala;
- no convierte a centavos enteros;
- no convierte a string;
- no corrige floating point;
- no aplica locale.

Las métricas ya redondeadas por `buildBalanceReport` se conservan exactamente.

### 9.4 Valores históricos

La evidencia preserva los valores almacenados relevantes:

- `baseCurrencyValue`;
- `secondaryCurrencyValue`;
- `eurValue`;
- `copValue`;
- códigos base y secundario cuando existan.

No se consulta tasa actual ni se recalcula historia. Tasas auxiliares que Financial Engine actual no consume quedan fuera del schema material v1.

### 9.5 Moneda no resoluble

Se conserva el resultado `0` caracterizado por el engine y se añade `currency.value_unresolvable` cuando existan registros pero ninguno aporte valor resoluble para la moneda solicitada.

No se representa como `null` ni se inventa conversión.

### 9.6 Ausencia y null

- Campo monetario opcional ausente: el valor histórico no fue almacenado o no aplica.
- `null`: PROHIBIDO EN V1 para dinero.
- `0`: valor presente y significativo.
- string vacío: inválido.

### 9.7 Positivos y negativos

Se preserva el signo original. Ajustes negativos permanecen negativos en evidencia, aunque agregados como `adjustmentsNegativeTotal` se presenten en magnitud positiva por la semántica existente del reporte.

## 10. Representación normativa de opcionales y colecciones

### 10.1 Campo ausente

Significa exactamente una de estas condiciones definida por schema:

- no aplica;
- no estaba disponible en el registro legacy;
- no fue almacenado históricamente.

No significa cero, vacío ni error.

### 10.2 `null`

PROHIBIDO EN V1 salvo que un campo futuro declare explícitamente `null` como valor de dominio. Ningún campo material inicial lo requiere.

### 10.3 String vacío

No representa ausencia. Para IDs, versiones, códigos, timezone, moneda, motivos y fechas es inválido.

Un label financiero efectivo vacío se trata como ausente y Financial Engine aplica su fallback existente.

### 10.4 Cero

Es valor presente y significativo. No puede omitirse por falsy checks.

Ejemplos:

- balance cero;
- duración cero;
- valor histórico cero;
- conteo cero.

### 10.5 Array vacío

Significa colección conocida y sin elementos.

- `records: []` con conteos cero representa evidencia embebida vacía válida.
- `warningCodes: []` significa sin warnings conocidos.
- `limitationCodes: []` significa sin limitaciones declaradas, salvo invariantes que obliguen una.

No equivale a colección no cargada.

### 10.6 Objeto vacío

Solo es válido donde el schema lo permita expresamente, por ejemplo `filters: {}` para scopes sin filtros adicionales. `materialFields: {}` es inválido para income o expense.

### 10.7 Campos opcionales serializados

Los opcionales ausentes se omiten. Nunca se serializan como `undefined`.

## 11. Schema mínimo de materialFields por fuente

### 11.1 Regla de frontera

V1 no amplía Financial Engine. Sus únicas fuentes financieras directas son income y expense. Ajuste es una clasificación de una de esas fuentes.

Cita, temporada y settings se resuelven como secciones de contexto, no como movimientos adicionales.

### 11.2 Income

Schema material mínimo:

```text
date: YYYY-MM-DD
resolvedType: ingreso | ajuste | otro
usageMode?: basic | professional
earningPeriodId?: positive integer
seasonPeriodId?: positive integer
duration: finite number
actualDuration?: finite number
currency: non-empty stored currency code
baseCurrency?: non-empty currency code
baseCurrencyValue?: finite number
secondaryCurrency?: non-empty currency code
secondaryCurrencyValue?: finite number
eurValue: finite number
copValue: finite number
effectiveFinancialLabel?: non-empty string
```

Reglas:

- `resolvedType` conserva el resultado de la clasificación existente.
- `duration` y `actualDuration` preservan precedencia actual; no se normalizan.
- `effectiveFinancialLabel` solo se incluye cuando afecta la salida estructurada.
- `totalAmount`, `percentage` y `realGain` no forman parte del resultado actual del adapter y quedan excluidos de evidencia v1.

### 11.3 Expense

Schema material mínimo:

```text
date: YYYY-MM-DD
type: gasto | ajuste
usageMode?: basic | professional
earningPeriodId?: positive integer
seasonPeriodId?: positive integer
currency: non-empty stored currency code
baseCurrency?: non-empty currency code
baseCurrencyValue?: finite number
secondaryCurrency?: non-empty currency code
secondaryCurrencyValue?: finite number
eurValue: finite number
copValue: finite number
effectiveFinancialLabel?: non-empty string
```

`amount`, `createdAt` y tasas auxiliares no consumidas por el engine quedan excluidos.

### 11.4 Ajuste

No existe una tercera fuente `adjustment`.

Un ajuste conserva:

- `source = income` y `resolvedType = ajuste`; o
- `source = expense` y `type = ajuste`.

Además conserva signo y label financiero efectivo cuando corresponda. Está prohibido convertirlo en ingreso ordinario o gasto ordinario.

### 11.5 Cita

Decisión v1:

- una cita no convertida NO participa en `FinancialEvidence`;
- no existe schema material de cita para Builder v1;
- cuando una cita se convierte mediante el flujo existente, participa únicamente el ingreso resultante;
- IDs, recordatorios, notas y estado de agenda no entran en el snapshot.

Esto evita ampliar Financial Engine o convertir agenda en fuente financiera.

### 11.6 Temporada

Decisión v1:

- temporada no se embebe como `FinancialEvidenceRecord`;
- el contexto mínimo vive en `SnapshotScope.earningPeriodId`;
- `kind = season` exige modo professional;
- nombre, estado, ciudad y metadata de temporada no participan en cálculo actual;
- Builder no consulta ni copia la entidad de temporada para calcular.

La validación futura de existencia del ID será una lectura contextual, no una fórmula financiera ni evidencia monetaria.

### 11.7 Settings

Decisión v1:

- settings no se embebe como registro de evidencia;
- solo se proyectan valores aprobados al scope/input:
  - `usageMode`;
  - `currency` de presentación;
  - `timezone` explícita suministrada por el caso de uso;
- secondary currency, theme, PIN, backup, Drive y preferencias quedan excluidos;
- Builder no recibe `AppSettings` completo.

### 11.8 Contexto frente a evidencia

```text
FinancialEvidence.records
    income | expense

SnapshotScope
    usageMode | currency | timezone | earningPeriodId | period | filters

Fuera de v1
    appointment | full earning period | full settings
```

## 12. Estrategia de evidencia

### 12.1 Alternativas evaluadas

#### Embebida

El candidato contiene todos los registros materiales proyectados.

Ventajas:

- reproducción local completa;
- sin dependencia de almacenamiento;
- contrato simple;
- auditabilidad inmediata;
- compatible con Builder in-memory.

Riesgos:

- tamaño;
- duplicación;
- exposición si se incluyen campos excesivos.

#### Referenciada

El candidato apunta a un paquete inmutable externo.

Ventajas:

- menor payload;
- posible deduplicación futura.

Riesgos:

- requiere persistencia content-addressed;
- referencia rota impide reproducción;
- fingerprint previo;
- complejidad transaccional.

#### Híbrida

Combina evidencia embebida y referencias.

Ventajas:

- flexibilidad futura.

Riesgos:

- ambigüedad de completitud;
- dos rutas de lectura;
- reglas de precedencia;
- mayor superficie de corrupción.

### 12.2 Decisión v1

**V1 usa exclusivamente evidencia embebida.**

Consecuencias:

- `FinancialEvidence.records` contiene el universo material completo aprobado;
- `records.length = candidateRecordCount`;
- `evidenceReference` debe estar ausente;
- `evidenceFingerprint` debe estar ausente hasta su milestone;
- un candidato no necesita Repository, Store ni red;
- no existe lazy loading;
- una colección parcial es inválida.

### 12.3 Minimización obligatoria

Evidencia embebida no significa copiar entidades completas. Solo se incluyen schemas materiales de la sección 11.

### 12.4 Umbral de tamaño

POSPUESTO a pruebas del Builder. Si el tamaño resulta problemático, no se truncará; se evaluará una versión posterior referenciada o híbrida.

## 13. Semántica de AppliedRule.order

### 13.1 Decisión

`AppliedRule.order` es el **índice base cero de la declaración ordenada devuelta por Financial Engine**.

No representa:

- prioridad;
- dependencia;
- severidad;
- orden de ejecución interno no observable;
- versión de regla.

### 13.2 Invariantes

Para N reglas:

```text
order = 0, 1, 2, ..., N - 1
```

- valores únicos;
- enteros no negativos;
- lista físicamente ordenada por `order`;
- sin huecos;
- sin reordenar alfabéticamente;
- el engine es la única fuente de la lista.

### 13.3 Reglas actuales

El orden inicial debe preservar exactamente el orden emitido por el adapter actual. Snapshot Builder mapea cada posición a `order`; no decide la secuencia.

### 13.4 RuleVersion ausente

Mientras no exista versión formal individual:

- `ruleVersion` ausente;
- `engineVersion` presente;
- `rulesetVersion = engine-bundled/<engineVersion>`;
- `limitationCodes` incluye `rule.version.unavailable`.

## 14. Catálogo inicial de códigos normativos

### 14.1 Convenciones

- lowercase ASCII;
- segmentos separados por punto;
- sin texto localizado;
- significado inmutable dentro de una versión;
- nuevas adiciones compatibles; cambios de significado requieren versión.

### 14.2 Generation reason

| Código | Significado |
| --- | --- |
| `generation.manual_audit` | Solicitud manual de auditoría |
| `generation.shadow_evaluation` | Evaluación futura sin promoción |
| `generation.reconstruction` | Reconstrucción explícita bajo otra versión |
| `generation.consumer_preparation` | Preparación para consumidor aún no promovido |

Builder v1 deberá comenzar únicamente con `generation.manual_audit` o un caso de prueba interno aprobado. Los demás no activan integraciones.

### 14.3 Revision reason

| Código | Significado |
| --- | --- |
| `revision.source_changed` | Cambió evidencia material |
| `revision.engine_changed` | Cambió engineVersion |
| `revision.ruleset_changed` | Cambió rulesetVersion o AppliedRules |
| `revision.snapshot_version_changed` | Reconstrucción bajo nueva snapshotVersion |
| `revision.canonicalization_changed` | Reconstrucción bajo nueva canonicalizationVersion |
| `revision.correction_after_invalidation` | Sucesor de artefacto invalidado |

Cambiar scope de identidad produce otra `snapshotKey`, no `revision.scope_changed`.

### 14.4 Exclusion codes

| Código | Significado |
| --- | --- |
| `evidence.excluded.before_period` | Fecha anterior al inicio |
| `evidence.excluded.at_or_after_period_end` | Fecha en/después del final exclusivo |
| `evidence.excluded.after_as_of` | Evidencia posterior a asOf |
| `evidence.excluded.usage_mode` | Modo distinto |
| `evidence.excluded.earning_period` | Periodo profesional distinto |
| `evidence.excluded.unsupported_source` | Fuente no consumida por v1 |

### 14.5 Coverage codes

| Código | Significado |
| --- | --- |
| `coverage.complete` | Universo aprobado completamente representado |
| `coverage.partial_as_of` | Periodo nominal aún no completo en asOf |
| `coverage.empty_dataset` | Universo válido sin registros |

Solo uno de estos códigos de cobertura principal debe aparecer.

### 14.6 Warning codes

| Código | Significado |
| --- | --- |
| `currency.value_unresolvable` | Moneda solicitada sin valor almacenado resoluble |
| `legacy.id.unavailable` | Registro sin ID persistido |
| `legacy.usage_mode.inferred` | Modo resuelto mediante compatibilidad legacy |
| `privacy.sensitive_label.present` | Label financiero derivado de contenido libre |
| `evidence.duplicate_material_record` | Múltiples ocurrencias materialmente idénticas |

### 14.7 Quality codes

| Código | Significado |
| --- | --- |
| `quality.validated_structure` | Invariantes pre-canonicalización superados |
| `quality.readonly_input` | No se detectó mutación de entrada |
| `quality.engine_result_preserved` | Resultado del engine conservado exactamente |
| `quality.embedded_evidence_complete` | Conteos y evidencia embebida completos |

### 14.8 Limitation codes

| Código | Significado |
| --- | --- |
| `rule.version.unavailable` | Regla sin versión individual formal |
| `canonicalization.not_applied` | Candidato todavía no canonicalizado |
| `fingerprint.not_applied` | Candidato todavía no sellado |
| `persistence.not_applied` | Artefacto no persistido |

Los tres últimos describen fase, no error. En SnapshotCandidate son obligatorios según corresponda; no deben sobrevivir incorrectamente en un snapshot sellado.

### 14.9 Failure/rejection codes

| Código | Significado |
| --- | --- |
| `snapshot.input.invalid` | Input estructuralmente inválido |
| `snapshot.scope.invalid` | Scope incumple reglas v1 |
| `snapshot.version.unsupported` | Versión no soportada |
| `snapshot.time.invalid` | Relación temporal inválida |
| `snapshot.evidence.incomplete` | Evidencia no reproduce universo esperado |
| `snapshot.evidence.count_mismatch` | Conteos inconsistentes |
| `snapshot.evidence.forbidden_data` | Datos prohibidos detectados |
| `snapshot.engine.failed` | Financial Engine lanzó fallo |
| `snapshot.engine.version_missing` | Engine sin versión |
| `snapshot.rules.invalid` | AppliedRules inconsistentes |
| `snapshot.input.mutated` | Se detectó mutación de entrada |

No se almacenan stack traces o payloads completos como código o mensaje normativo.

## 15. Matriz normativa de compatibilidad

### 15.1 Dimensiones

La compatibilidad se evalúa por separado en:

- schema/semántica del snapshot;
- canonicalización;
- engine;
- ruleset;
- scope;
- evidencia;
- fingerprint futuro.

### 15.2 Matriz

| Snapshot A vs B | Lectura estructural | Comparación financiera | Fingerprint comparable | Reproducción equivalente |
| --- | --- | --- | --- | --- |
| Mismas versiones, key y evidencia | Sí | Sí, exacta | Sí, cuando exista | Sí |
| snapshotVersion PATCH distinto, sin cambio material | Sí | Sí | Solo si canonicalization/fingerprint iguales | Sí |
| snapshotVersion MINOR compatible | Sí con lector nuevo | Sí bajo proyección común explícita | No por defecto | Solo si engine/ruleset iguales |
| snapshotVersion MAJOR distinto | No por defecto | No sin adaptador aprobado | No | No |
| canonicalizationVersion distinta | Sí si schema soportado | Puede ser | No | Contenido financiero puede reproducirse, bytes no |
| engineVersion distinta | Sí | Solo como revisiones distintas | No | No se asume |
| rulesetVersion distinta | Sí | Solo como revisiones distintas | No | No se asume |
| AppliedRules distintas | Sí | No se asume | No | No |
| snapshotKey distinta | Sí | Solo análisis externo futuro | No | No representa mismo ámbito |
| Misma key, revisión distinta | Sí | Sí como comparación histórica | No | Cada revisión se reproduce por separado |
| Evidencia material distinta | Sí | Sí como revisión | No | No |
| Timezone o límites distintos | Sí | No como mismo scope | No | No |
| `inclusive` vs `exclusive` | V1 rechaza inclusive | No | No | No |

### 15.3 Reglas de lectura

- Un lector v1 rechaza MAJOR desconocida.
- Un lector no modifica el artefacto para hacerlo compatible.
- Las proyecciones compatibles son vistas derivadas, no migraciones in-place.
- “Financieramente igual” no implica mismo fingerprint si versiones o reglas difieren.
- Igual balance general no demuestra equivalencia del snapshot completo.

### 15.4 Reconstrucción

Reconstruir bajo engine, ruleset o snapshotVersion diferente crea revisión nueva. El original permanece intacto.

## 16. Decisiones explícitamente pospuestas

### 16.1 A canonicalización

- algoritmo exacto de orden de claves;
- encoding canónico en bytes;
- algoritmo del identity digest;
- agrupación canónica del multiset legacy;
- reglas exactas de orden de evidencia con IDs presentes;
- vectores de prueba canónicos.

### 16.2 A fingerprint y sellado

- algoritmo criptográfico;
- separación de dominio exacta;
- formato de fingerprint;
- firma/autenticidad;
- campos operacionales excluidos del fingerprint;
- verificación de colisiones;
- generación efectiva de snapshotId, key y revisión final.

### 16.3 A persistencia

- tabla o schema Dexie;
- Repository y Store;
- índices;
- transacciones;
- retención;
- compactación;
- backup/restore;
- importación/exportación;
- manejo de colisiones entre dispositivos;
- réplica remota.

### 16.4 A adopción

- Shadow Mode de Snapshot;
- Promotion Policy de Snapshot;
- feature flag;
- consumidor piloto;
- fallback;
- métricas de paridad sostenida;
- UI y presentación.

### 16.5 A capas posteriores

- Rule Registry formal;
- Knowledge Layer;
- Insight Engine;
- LLM Assistant;
- Notification Center;
- eventos de snapshot;
- Automation Gateway;
- Neon/n8n/workflows.

### 16.6 Otras decisiones no bloqueantes

- umbral máximo de evidencia embebida;
- evidencia referenciada v2;
- catálogo de sujetos locales;
- scope `trip`;
- fuentes financieras adicionales;
- autenticidad multi-dispositivo.

## 17. Checklist de bloqueo por fase

### 17.1 Debe estar decidido antes de implementar Builder

- [x] Separación Execution/Candidate/Sealed.
- [x] Estados permitidos de cada artefacto.
- [x] Campos exclusivos del sellado.
- [x] Formato namespace de IDs y versiones.
- [x] Revisión lineal desde 1.
- [x] Scope kinds v1 y prohibición de trip.
- [x] Periodos `[start, end)`.
- [x] Fechas civiles, instantes UTC y timezone IANA.
- [x] Semántica de `asOf`.
- [x] Dinero como JSON number sin redondeo nuevo.
- [x] Semántica de opcionales y null.
- [x] Schemas materiales de income/expense/adjustment.
- [x] Cita excluida y temporada/settings como contexto.
- [x] Evidencia embebida v1.
- [x] Identidad legacy por preimage material/multiset.
- [x] AppliedRule.order base cero contiguo.
- [x] rulesetVersion ligada al engine.
- [x] Catálogo inicial de códigos.
- [x] Matriz inicial de compatibilidad.

Antes de escribir Builder todavía será obligatorio reflejar estas decisiones en los contratos TypeScript mediante un milestone explícito. Este documento no modifica código.

### 17.2 Puede esperar a canonicalización

- [ ] Orden canónico total.
- [ ] Encoding de bytes.
- [ ] Digest de snapshotKey.
- [ ] Multiset canónico.
- [x] Representación canónica de cero negativo cerrada para V1.
- [x] Documento canónico versionado definido contractualmente.
- [ ] Vectores de prueba de canonicalización.

Builder podrá producir únicamente `SnapshotCandidate`; no podrá afirmar canonicalidad.

### 17.3 Puede esperar a fingerprint/sellado

- [ ] Algoritmo de fingerprint.
- [ ] `fingerprintVersion` definitiva.
- [ ] Domain separation.
- [ ] Generación de `snapshotId` y key final.
- [ ] Asignación final de revisión.
- [ ] `sealedAt`.
- [ ] Transición Candidate -> Sealed.

### 17.4 Puede esperar a persistencia

- [ ] Dexie schema y migración.
- [ ] Repository/Store.
- [ ] Índices y transacciones.
- [ ] Backup/restore.
- [ ] Retención e invalidación persistida.
- [ ] Published/superseded operacional.

### 17.5 Bloqueos que siguen vigentes para Builder

Aunque las decisiones conceptuales quedan cerradas, Builder NO debe implementarse hasta:

1. actualizar el modelo 3A para separar los tres artefactos;
2. tipar schemas materiales v1 sin objetos JSON abiertos ambiguos;
3. incorporar `rulesetVersion`;
4. reemplazar `SnapshotStatus` mixto por estados discriminados;
5. distinguir fechas civiles de instantes al menos mediante aliases de dominio;
6. retirar fingerprint, canonical y revisión final del contrato de candidato;
7. aprobar ese ajuste de contratos como milestone separado.

## 18. Coherencia arquitectónica

### 18.1 Constitución

- Mantiene Local First.
- No modifica cálculos ni balances históricos.
- No introduce IA con autoridad financiera.
- Preserva trazabilidad y seguridad.

### 18.2 AI Core

- Financial Engine sigue siendo único productor de cálculo.
- Financial Snapshot permanece derivado y de solo lectura.
- Rule Registry y capas posteriores siguen futuras.
- n8n no contiene lógica financiera.

### 18.3 Financial Snapshot Architecture

- Separa identidad, revisión, versiones y evidencia.
- Preserva append-only.
- Formaliza reproducción sin persistencia.
- Pospone canonicalización y fingerprint a sus fases.

### 18.4 Invariantes

- Resuelve la tensión de estados mixtos.
- Cierra conteos y estrategia de evidencia.
- Formaliza fechas, dinero, opcionales y reglas.
- Mantiene casos inválidos y límites normativos.

### 18.5 Una sola fuente financiera

```text
Dexie
    movimientos operativos canónicos
        │ lectura
        ▼
Financial Engine
    único cálculo derivado
        │ resultado exacto
        ▼
SnapshotCandidate
    evidencia + resultado, sin recalcular
        │ fases futuras
        ▼
SealedFinancialSnapshot
    evidencia inmutable, no nuevo libro
```

Ninguna decisión de este documento autoriza que Snapshot Builder calcule balances, convierta monedas, clasifique ajustes o resuelva reglas por una ruta paralela.

## 19. Riesgos residuales

### 19.1 Privacidad del label efectivo

El resultado actual puede incluir labels derivados de notas. Conservar solo el label efectivo minimiza exposición, pero sigue siendo potencialmente sensible y requiere pruebas de filtrado/logging.

### 19.2 Modelo actual desalineado

`src/types/financialSnapshot.ts` todavía representa el diseño previo a estas decisiones. No debe usarse como base directa de Builder hasta un milestone de ajuste de contratos.

### 19.3 Identidad content-addressed sin canonicalización

La estrategia está decidida, pero no puede ejecutarse antes de definir encoding y digest. Builder debe conservar preimages, no fabricar claves finales.

### 19.4 Números IEEE-754

Mantener JSON number preserva paridad actual, pero la representación canónica de floats requerirá decisión cuidadosa. No se puede “corregir” con decimal strings dentro de Builder.

### 19.5 Reproducibilidad de runtimes antiguos

`rulesetVersion` ligada al engine es honesta, pero reproducir historia exigirá conservar compatibilidad con versiones antiguas del engine o una política futura de reconstrucción.

### 19.6 Evidencia embebida

Es la opción más segura para v1 in-memory, pero puede crecer. El tamaño debe medirse antes de persistencia; no se truncará silenciosamente.

### 19.7 Códigos iniciales incompletos

El catálogo cubre Builder v1, no todas las fases. Agregar códigos es compatible; cambiar significado no.

### 19.8 Timezone de settings

El modelo actual de settings no expone timezone canónica. El caso de uso futuro deberá suministrarla explícitamente sin modificar settings dentro del milestone Builder.

## 20. Decisiones cerradas

Quedan cerradas para planificación de Builder:

1. tres artefactos separados;
2. estados y transiciones por artefacto;
3. campos exclusivos del sellado;
4. namespaces de identidad y versiones;
5. revisión lineal desde 1;
6. identidad legacy content-addressed y multiset;
7. fecha civil ISO, instantes UTC e IANA timezone;
8. periodos semiabiertos;
9. dinero como JSON number compatible con engine;
10. semántica de ausencia, null, vacío, cero y arrays;
11. schemas materiales mínimos y fronteras de fuentes;
12. evidencia embebida v1;
13. AppliedRule.order como índice base cero;
14. rulesetVersion ligada al bundle del engine;
15. catálogo inicial de códigos;
16. matriz inicial de compatibilidad;
17. clasificación de decisiones por milestone posterior.

## 21. Criterio de cierre

Este milestone queda cerrado cuando:

- el documento es el único archivo nuevo de la tarea;
- no se modifica `DECISIONS.md`;
- no se implementa código;
- Builder continúa inexistente;
- las decisiones bloqueantes están cerradas conceptualmente;
- los cambios requeridos al modelo quedan identificados para un milestone separado;
- `git diff --check` no detecta errores;
- no existe modificación de Financial Engine, Dexie, Neon, n8n, workflows, UI o consumidores.

La siguiente acción recomendada no es implementar Builder directamente. Es ejecutar un milestone pequeño de **alineación de contratos 3A** con estas decisiones, seguido de revisión y compilación. Solo después podrá diseñarse Snapshot Builder in-memory.

## 22. Decisiones normativas de desbloqueo para canonicalización V1

Esta sección tiene carácter vinculante para el Milestone 3C y prevalece sobre las referencias anteriores de este documento que describen estas materias como pendientes. No implementa canonicalización, fingerprint, sellado ni persistencia.

### 22.1 Cero negativo

Canonicalización V1 DEBE normalizar todo JSON number cuyo valor sea `-0` a `0`.

Motivos:

- JSON carece de una semántica interoperable que obligue a preservar la distinción IEEE-754 entre `-0` y `0` después de múltiples parsers y runtimes;
- el dominio financiero actual no atribuye significado distinto a ambos valores;
- dos resultados financieramente equivalentes no deben producir bytes canónicos distintos por una propiedad incidental del runtime;
- la normalización estabiliza la futura preimagen del fingerprint sin redondear ni cambiar magnitud.

Impacto normativo:

- la regla se aplica recursivamente a cualquier número material del documento canónico;
- `Object.is(value, -0)` es el criterio conceptual inequívoco para detectar el caso;
- no se transforma ningún otro número;
- no se redondean decimales;
- no se convierten números a strings;
- `NaN`, `Infinity` y `-Infinity` continúan siendo inválidos;
- un campo ausente, un string vacío y un array vacío no se ven afectados.

Compatibilidad y casos límite:

- candidates que contengan `0` o `-0` son financieramente compatibles bajo V1 y producen el mismo valor canónico `0`;
- arrays con varias ocurrencias conservan cantidad y posición semántica aunque sus ceros negativos se normalicen;
- valores negativos distintos de cero, incluidos subnormales finitos, se preservan exactamente;
- cambiar en el futuro esta política exige una nueva `canonicalizationVersion`.

Efecto futuro:

- los bytes canónicos de `-0` serán los mismos que los de `0`;
- fingerprints calculados sobre esos bytes serán iguales cuando esa sea la única diferencia;
- snapshots ya sellados bajo una versión futura distinta nunca se reinterpretarán in-place.

### 22.2 Fase explícita `draft -> validated`

Canonicalización solo podrá recibir `ValidatedSnapshotCandidate`. Un `DraftSnapshotCandidate` debe atravesar previamente la función pura:

```text
validateSnapshotCandidate(draft) -> ValidatedSnapshotCandidate
```

Decisiones vinculantes:

- la función acepta exclusivamente estado `draft`;
- entradas `validated` o `rejected` se rechazan con error determinista;
- la salida conserva todo contenido material y cambia únicamente el discriminante a `validated`;
- la salida es una copia estructural independiente;
- la validación no recalcula finanzas, no canonicaliza, no genera fingerprint, no sella y no persiste;
- la validación vuelve a comprobar invariantes aunque el candidate proceda del Builder, porque el contrato puede recibirse desde fronteras futuras;
- un fallo no produce un candidate parcial ni modifica la entrada.

Validaciones V1 autorizadas:

- identidad del candidate presente;
- versiones presentes y compatibilidad mínima declarada;
- `snapshotVersion = financial-snapshot/1.0.0`;
- `canonicalizationVersion = financial-snapshot-c14n/1.0.0`;
- `rulesetVersion = engine-bundled/<engineVersion-verbatim>`;
- scope completo, periodo creciente y límite `[start,end)`;
- scope de temporada únicamente profesional y con `earningPeriodId`;
- evidencia `embedded-v1`, tipos permitidos y conteos coherentes;
- identidad y fecha lógica mínimas de evidencia;
- `AppliedRule.order` contiguo desde cero, IDs únicos y versiones coherentes;
- metadata local obligatoria;
- estructura JSON sin `null`, `undefined`, `Date`, números no finitos, funciones, símbolos, bigint, clases ni ciclos.

Estas comprobaciones son estructurales. No comparan evidencia con balances ni duplican fórmulas de Financial Engine.

### 22.3 `CanonicalSnapshotDocument`

La salida contractual de canonicalización V1 será un documento envolvente versionado:

```text
CanonicalSnapshotDocument {
  canonicalizationVersion
  payload: CanonicalFinancialSnapshotPayload
}
```

Responsabilidades:

- `canonicalizationVersion` identifica las reglas exactas que produjeron la representación;
- `payload` contiene exclusivamente el contenido financiero canónico;
- la separación permite evolucionar el proceso sin presentar metadata operacional como contenido financiero.

Campos prohibidos en este documento:

- fingerprint o algoritmo de fingerprint;
- `sealedAt`;
- revisión final;
- `snapshotId`, `snapshotKey` o identidad content-addressed definitiva;
- estado `sealed`, `persisted` o `published`;
- metadata de persistencia.

Crear este contrato no afirma que exista todavía una representación canónica. Solo fija la forma de salida que deberá producir el Milestone 3C. El documento no es un `SealedFinancialSnapshot`, no es persistible por sí mismo y no autoriza calcular fingerprints.

### 22.4 Criterio de desbloqueo

Milestone 3C queda normativamente desbloqueado cuando:

- el contrato TypeScript de `CanonicalSnapshotDocument` compile;
- el validador `draft -> validated` tenga pruebas de invariantes, determinismo e inmutabilidad;
- canonicalización acepte posteriormente solo `ValidatedSnapshotCandidate`;
- la política `-0 -> 0` se pruebe como regla de canonicalización V1;
- no exista todavía fingerprint, sellado, revisión final o persistencia.

## 23. Decisiones normativas del fingerprint V1

Esta sección es vinculante para el Milestone 3D. Define integridad determinista, no firma, autenticidad, identidad definitiva, revisión, sellado o persistencia.

### 23.1 Algoritmo

Fingerprint V1 DEBE utilizar **SHA-256** mediante Web Crypto API estándar.

Justificación:

- interoperabilidad entre navegadores modernos y el runtime Node usado por tests;
- disponibilidad sin dependencias criptográficas externas;
- algoritmo estable, ampliamente implementado y sin debilidades prácticas conocidas para integridad por colisión en este dominio;
- salida fija de 256 bits adecuada para comparación y verificación futura.

MD5, SHA-1 y algoritmos no criptográficos quedan prohibidos. El algoritmo no es configurable por usuario, entorno o consumidor. Cambiarlo exige una nueva `fingerprintVersion`.

### 23.2 Encoding de entrada

La entrada exacta al digest es:

```text
UTF8(domainSeparator + serializeCanonicalSnapshotDocument(document))
```

Reglas:

- `serializeCanonicalSnapshotDocument` aporta el string canónico completo;
- la concatenación no añade espacios, saltos de línea, terminadores ni BOM;
- `TextEncoder` aplica UTF-8;
- no se hashea la entrada original ni una serialización alternativa.

### 23.3 Encoding de salida y versión

El digest de 32 bytes se representa como **hexadecimal lowercase**:

- exactamente 64 caracteres;
- alfabeto `[0-9a-f]`;
- dos caracteres por byte, incluidos ceros iniciales;
- sin prefijo `0x`, separadores o padding.

Decisión frente a base64url: hexadecimal lowercase es más simple de inspeccionar, copiar y comparar en auditorías, no requiere reglas de padding y mantiene representación textual inequívoca.

Versión normativa inicial:

```text
financial-snapshot-fingerprint/1.0.0
```

`SnapshotFingerprint` declara algoritmo, encoding, dominio, versión de fingerprint, versión de canonicalización y valor.

### 23.4 Domain separation

Separador exacto, sensible a mayúsculas y con `:` final:

```text
private-balance:financial-snapshot:fingerprint:v1:
```

La preimagen se construye por concatenación directa:

```text
private-balance:financial-snapshot:fingerprint:v1:<canonical-document>
```

El separador evita que el mismo JSON y algoritmo se reutilicen accidentalmente como digest de otra entidad, protocolo o propósito. Cambiar cualquier carácter del dominio exige otra `fingerprintVersion` y produce necesariamente otra huella.

### 23.5 Alcance exacto de la preimagen

La preimagen incluye:

- el domain separator completo;
- el `CanonicalSnapshotDocument` completo;
- `canonicalizationVersion`, por formar parte del documento;
- todo el payload canónico: versiones, scope, resultado de Financial Engine, evidencia, reglas y metadata canónica.

La preimagen no incluye:

- reloj o timestamp generado por la operación de fingerprint;
- salt, nonce, secreto o clave;
- `snapshotId` o `snapshotKey` definitivo;
- revisión final;
- `sealedAt`;
- estado de sellado o persistencia;
- datos externos al documento canónico.

El fingerprint no prueba autoría ni autenticidad. Solo permite verificar que la misma preimagen produce el mismo digest y detectar cambios materiales cubiertos por el documento.

### 23.6 Contrato y errores

La operación pública normativa es asíncrona porque Web Crypto devuelve una promesa:

```text
fingerprintCanonicalSnapshotDocument(document) -> Promise<SnapshotFingerprint>
```

Debe fallar de forma cerrada cuando:

- Web Crypto o `subtle.digest` no estén disponibles;
- el documento no pueda serializarse canónicamente;
- SHA-256 no esté soportado por el runtime;
- el digest no pueda convertirse al encoding normativo.

Los errores no incluyen documento, preimagen, valores financieros ni stack serializado. La operación no muta, persiste, sella ni asigna identidad.

## 24. Decisiones normativas del sellado in-memory V1

Esta sección es vinculante para el Milestone 3E y prevalece sobre formatos históricos incompatibles descritos anteriormente, incluido el `snapshotId` basado en UUID. Sellar no implica persistir, publicar, sincronizar ni autenticar.

### 24.1 `snapshotId` definitivo

El identificador se deriva exclusivamente del fingerprint verificado:

```text
financial-snapshot:<fingerprintVersion>:<fingerprint.value>
```

Para V1:

```text
financial-snapshot:financial-snapshot-fingerprint/1.0.0:<64-hex-lower>
```

Propiedades:

- determinista y content-addressed;
- no usa UUID, reloj, aleatoriedad, contador o almacenamiento;
- mismo documento y fingerprint producen el mismo `snapshotId`;
- contenido diferente produce otro ID salvo colisión criptográfica;
- no incluye revisión ni `sealedAt`.

### 24.2 `snapshotKey` lógico

V1 no dispone todavía de un sujeto local seudónimo aprobado. Por tanto, no se inventa user/device context. La key se deriva del `SnapshotScope` canónico completo:

```text
pbsk:v1:<scope-kind>:<percent-encoded-canonical-scope-json>
```

El scope canónico contiene exactamente:

- kind;
- `periodStart`;
- `periodEndExclusive`;
- límite `[start,end)`;
- timezone;
- usageMode;
- currency;
- `earningPeriodId` cuando exista;
- filtros materiales.

El percent-encoding usa `encodeURIComponent` sobre una proyección canónica de esas dimensiones, sin locale ni normalización adicional. No participan `asOf`, fingerprint, revisión, versiones de engine/ruleset/snapshot, metadata, notas o datos externos. `asOf` permanece material en el documento y fingerprint, pero su cambio dentro del mismo ámbito genera otra revisión bajo la misma key.

El llamador suministra `snapshotKey`; el sellador deriva el valor esperado desde el documento y exige igualdad exacta. Esto permite integrar un contexto de sujeto futuro mediante una nueva versión de key sin aceptar claves arbitrarias hoy.

### 24.3 Revisión y duplicados

- `revision` es un JSON number entero finito mayor o igual que `1`;
- se recibe explícitamente y nunca se consulta o infiere desde persistencia;
- revisión `1` no admite `supersedesSnapshotId`;
- revisión mayor que `1` exige `supersedesSnapshotId` no vacío;
- `revisionReasonCode` es obligatorio y no vacío;
- no se valida existencia del predecesor en esta fase.

Dos sellados materialmente idénticos conservan el mismo fingerprint y `snapshotId`, incluso si el llamador declara revisiones diferentes. Esta fase no deduplica ni reserva revisiones. Persistencia deberá impedir cadenas ambiguas y decidir si una revisión duplicada se rechaza como no material.

### 24.4 `sealedAt`

`sealedAt` se recibe explícitamente como `UtcInstant` con formato V1 UTC RFC 3339 y milisegundos:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

El sellador:

- no consulta reloj;
- no usa `Date`;
- rechaza string vacío o formato distinto;
- exige `sealedAt >= metadata.generatedAt` mediante comparación de strings normativos UTC.

### 24.5 Supersedes y estado

`supersedesSnapshotId` es opcional por ausencia y nunca `null`. Cuando existe:

- debe ser string no vacío;
- referencia conceptualmente la revisión inmediatamente anterior;
- no se consulta almacenamiento para comprobar su existencia.

El único estado producido por el sellador V1 es:

```text
sealed
```

`persisted`, `published`, `superseded` e `invalidated` no son salidas válidas de esta operación.

### 24.6 Entrada y verificación

`SnapshotSealingInput` contiene:

- `canonicalDocument`;
- `fingerprint` recibido;
- `snapshotKey` esperado;
- `revision`;
- `revisionReasonCode`;
- `sealedAt`;
- `supersedesSnapshotId` opcional.

Metadata final, scope, versiones, evidencia y reglas se obtienen exclusivamente del documento canónico para evitar copias divergentes.

Antes de construir el artefacto, el sellador recalcula el fingerprint y compara exactamente:

- algorithm;
- encoding;
- domain;
- fingerprintVersion;
- canonicalizationVersion;
- value.

Cualquier divergencia falla cerrado. El documento, fingerprint y entrada no se modifican, y la salida contiene copias estructurales independientes.

## 25. Decisiones normativas de persistencia local append-only V1

Esta sección es vinculante para el Milestone 3F. La persistencia es local y auditable; no modifica el libro financiero operativo, no publica el snapshot y no crea sincronización.

### 25.1 Tabla, identidad e índices

- La tabla Dexie se denomina `financialSnapshots` y nace en FinanceDB v23.
- `snapshotId` es la clave primaria porque identifica contenido sellado y verificado.
- El registro serializable `PersistedFinancialSnapshot` conserva el documento canónico, fingerprint, revisión, razón, sellado, persistencia y versiones.
- Solo se denormalizan para índices `snapshotKey`, `revision`, `sealedAt`, `status`, `scopeKind`, `scopePeriodStart` y `fingerprintValue`.
- `[snapshotKey+revision]` es único y constituye la barrera de cadena además de la clave primaria.

No se incorpora ID local autoincremental: añadirlo permitiría duplicar una misma identidad content-addressed sin aportar semántica de dominio.

### 25.2 Append-only y retención

Solo `INSERT` está permitido. No existe API ordinaria de update o delete y la tabla instala hooks que rechazan modificación, borrado y clear. Todo reemplazo material crea otra revisión. V1 conserva todas las revisiones sin borrado automático.

`financialSnapshots` no participa en reset, backup ni restore del libro operativo: dichos flujos no pueden borrar, reemplazar o importar una cadena de auditoría.

### 25.3 Revisión, duplicados y concurrencia

La siguiente revisión se obtiene dentro de la misma transacción Dexie que inserta el registro: primera revisión `1`; posteriores `latest + 1`. El repositorio no confía en una revisión propuesta para reservar posiciones y exige que una revisión posterior sellada coincida con la posición y predecesor reales.

- mismo `snapshotId`: éxito idempotente y devolución de copia del registro existente;
- mismo `[snapshotKey+revision]` con otro `snapshotId`: conflicto determinista;
- mismo contenido solicitado como nueva revisión: conserva el mismo `snapshotId`, por tanto se resuelve idempotentemente y no crea una revisión no material;
- dos escritores concurrentes: la transacción y el índice único permiten una sola inserción para la posición; una colisión restante falla como conflicto determinista.

### 25.4 Cadena `supersedes`

La revisión 1 no admite predecesor. Para revisiones posteriores, `supersedesSnapshotId` debe existir, pertenecer al mismo `snapshotKey`, ser la revisión inmediatamente anterior y ser el latest actual. Estas condiciones impiden bifurcaciones incompatibles. El registro persistido toma el predecesor comprobado, sin mutar el snapshot recibido.

### 25.5 Integridad, tiempo y copias

Antes de abrir la escritura, el repositorio invoca el sellador oficial, que recalcula y compara el fingerprint y deriva de nuevo identidad y key. No recalcula finanzas. `persistedAt` es obligatorio, explícito y con formato UTC V1; el repositorio no consulta reloj. Entradas y lecturas se clonan estructuralmente para impedir mutación posterior por referencia.

### 25.6 Errores y rollback conceptual

Los errores públicos son códigos deterministas sin contenido financiero: `SNAPSHOT_PERSISTENCE_REVISION_CONFLICT`, `SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES`, `SNAPSHOT_PERSISTENCE_INTEGRITY_FAILURE`, `SNAPSHOT_PERSISTENCE_NOT_FOUND` y `SNAPSHOT_PERSISTENCE_SCHEMA_ERROR`. La idempotencia es un resultado exitoso, no un error.

Dexie no soporta downgrade automático. El rollback conceptual de v23 consiste en retirar consumidores/escritores manteniendo la base y la tabla intactas; nunca se borra IndexedDB para retroceder.

## 26. Decisiones normativas del shadow mode observacional V1

Esta sección registra lo implementado por Milestone 4A:

- consumidor único: `homeBalanceSummaryService`, únicamente `home.balance.current-month`;
- scope único: `monthly`, semiabierto y con tiempos, timezone, modo, moneda y periodo profesional explícitos;
- flag independiente: solo `VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED=true` habilita ejecución;
- Financial Engine se ejecuta una vez y su resultado existente se entrega al Builder;
- el servicio no consulta Dexie para reconstruir ingresos o egresos; solo el repository accede a `financialSnapshots`;
- evidencia v1 respeta los schemas materiales aprobados y excluye entidades completas, notas, contactos, direcciones, secretos y payloads externos;
- fingerprint igual para la misma key es idempotencia y no consume revisión;
- fingerprint nuevo crea revisión lineal y `supersedes` referencia el latest previo;
- comparación limitada a versiones, identidad/revisión, conteos, totales, duración y códigos;
- logging solo en desarrollo y sin evidencia, documento canónico, fingerprint completo ni datos personales;
- cualquier fallo queda aislado del resultado oficial de Home.

No se crea Promotion Policy de Snapshot. El flag habilita observación y persistencia local, no promoción; Legacy/Financial Engine siguen gobernando el resultado visible según la policy preexistente de Home.

## 27. Decisiones normativas de Snapshot Promotion Policy V1

Milestone 4B incorpora exclusivamente `assessSnapshotPromotion(snapshot)`, una función síncrona, pura y determinista. Su salida contiene `eligible`, la secuencia completa de checks, los checks fallidos y warnings ordenados. No incluye score: elegibilidad exige conjunción de todos los checks obligatorios y ningún resultado parcial compensa un fallo.

Compatibilidad V1 es cerrada: `financial-snapshot/1.0.0`, `financial-snapshot-c14n/1.0.0`, `financial-snapshot-fingerprint/1.0.0`, SHA-256 y engine `1.0.0-phase-1a-minimal`. Versiones desconocidas no son elegibles. Las reglas deben pertenecer al conjunto declarado por ese engine y conservar orden base cero, engine y ruleset coherentes.

La policy comprueba coherencia estructural de fingerprint, identidad y documento, pero no recalcula hashes ni canonicaliza. Comprueba `supersedes` solo dentro del artefacto: revisión 1 sin predecesor y revisión posterior con referencia no vacía. Existencia del predecesor, latest real, idempotencia y conflictos requieren contexto de repository y quedan expresamente fuera de esta función.

La policy no lee Dexie, no usa red, reloj o aleatoriedad, no persiste, no repara y no promueve. Warnings declarados por el snapshot no bloquean por sí mismos. Snapshot continúa como artefacto derivado y no oficial.

## 28. Decisiones normativas de ejecución controlada de promoción — Milestone 4C

- El único consumidor autorizado es `homeBalanceSummaryService` para `home.balance.current-month`.
- Solo el texto exacto de build `VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED=true` habilita el intento. El flag es independiente de Financial Engine Home y Snapshot Shadow Mode.
- El resultado oficial vigente se calcula y conserva antes de cualquier lectura. Es el fallback obligatorio ante todo fallo.
- La promoción exige repository local, revisión latest única, cadena consecutiva desde revisión 1 y enlaces `supersedes` exactos.
- Se recalcula el fingerprint del documento canónico y deben coincidir fingerprint, `fingerprintValue` y `snapshotId` content-addressed.
- Scope kind, moneda, timezone, intervalo semiabierto, usage mode y `earningPeriodId` deben coincidir exactamente con la solicitud.
- `engineVersion` y `rulesetVersion` deben coincidir con el Financial Engine vigente y `SnapshotPromotionPolicy` debe devolver `eligible = true`.
- El `engineResult` debe satisfacer el contrato esperado antes de devolverse y se entrega como copia independiente.
- El executor no calcula cifras, no compara métricas manualmente, no crea snapshots, no repara cadenas y no persiste la decisión.
- Producción no emite logs ni telemetría. Desarrollo solo puede registrar fuente, key, revisión, versiones, scope kind, checks fallidos y razón normalizada.
- Rollback: retirar o desactivar el flag, rebuild y redeploy. No requiere migración ni limpieza.
- Financial Snapshot continúa sin autoridad global y no existe promoción automática.

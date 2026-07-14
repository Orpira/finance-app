# 10 — Financial Snapshot Architecture

> **ADVERTENCIA — ESPECIFICACIÓN DEL SIGUIENTE MILESTONE**
>
> **Este documento define la arquitectura objetivo de Financial Snapshot. Financial Snapshot no está implementado, no está persistido y no está desplegado. Ninguna tabla, servicio, evento, workflow o contrato conceptual descrito aquí debe tratarse como existente hasta completar y verificar su fase correspondiente.**

## 1. Estado y autoridad del documento

- **Tipo:** especificación arquitectónica del milestone Financial Snapshot.
- **Estado:** propuesta oficial para aprobación e implementación incremental.
- **Ámbito:** construcción, canonicalización, sellado, versionado, evidencia y ciclo de vida de Financial Snapshot.
- **Estado real:** no existe actualmente un componente Financial Snapshot.
- **Autoridad superior:** `PRIVATE_BALANCE_CONSTITUTION.md` y ADRs aceptadas en `DECISIONS.md`.
- **Arquitectura marco:** `09_AI_CORE_ARCHITECTURE.md`.

Este documento concreta exclusivamente el componente Financial Snapshot previsto por AI Core. No autoriza cambios financieros, persistencia, sincronización, automatización ni promoción de consumidores. Cada fase necesitará alcance, implementación y validación independientes.

### 1.1 Convenciones de estado

- **[IMPLEMENTADO]:** existe hoy en el repositorio y tiene comportamiento verificable.
- **[OBJETIVO DEL MILESTONE]:** contrato que este milestone deberá materializar de forma incremental.
- **[FUTURO]:** integración posterior fuera del milestone inicial.
- **[PENDIENTE DE DECISIÓN]:** requiere ADR o decisión técnica antes de implementarse.
- **[NO IMPLEMENTADO]:** no debe asumirse disponible en runtime, Dexie, Neon o workflows.

### 1.2 Regla de interpretación

Cuando este documento utilice nombres como `FinancialSnapshot`, `SnapshotVersion` o `CanonicalSnapshot`, describe **conceptos de dominio**, no clases, interfaces TypeScript, tablas ni DTOs existentes.

## 2. Propósito

Financial Snapshot debe representar el estado financiero derivado de un ámbito concreto de Private Balance como una evidencia:

- determinista;
- inmutable una vez sellada;
- reproducible;
- versionada;
- auditable;
- local-first;
- independiente de UI, red y servicios externos.

Su propósito es preservar no solo un resultado financiero, sino también el contexto y la evidencia necesarios para demostrar cómo se obtuvo. Debe permitir reconstruir exactamente el estado financiero **representado por el snapshot** en un instante lógico determinado, aun cuando los registros operativos cambien después.

Un snapshot no sustituye los movimientos de Dexie. Dexie continúa siendo el libro financiero operativo canónico. Financial Snapshot es un artefacto derivado, sellado y verificable construido por encima de ese libro mediante Financial Engine.

## 3. Problema que resuelve

Hoy Private Balance puede recalcular balances desde el estado local vigente, y AI Foundation aporta un adapter determinista con paridad controlada. Sin embargo, un cálculo actual por sí solo no responde de forma durable a preguntas como:

- ¿qué datos exactos participaron en este balance?
- ¿qué registros quedaron excluidos y por qué?
- ¿qué moneda, modo, temporada, periodo y timezone se aplicaron?
- ¿qué versión del motor produjo el resultado?
- ¿qué reglas identificadas participaron?
- ¿el mismo conjunto de evidencia produciría hoy el mismo resultado?
- ¿qué cambió entre dos resultados del mismo periodo?
- ¿por qué el balance histórico visible entonces era distinto del actual?

Guardar únicamente totales no resuelve estas preguntas. Guardar únicamente un hash tampoco permite reconstruir el cálculo. Volver a consultar Dexie más tarde tampoco garantiza la misma evidencia, porque el libro operativo puede recibir actualizaciones, eliminaciones autorizadas, importaciones o correcciones.

Financial Snapshot resuelve ese vacío mediante un artefacto que vincula de forma indivisible:

1. el ámbito financiero solicitado;
2. la proyección de evidencia relevante;
3. las reglas y versiones conocidas;
4. el resultado determinista;
5. la canonicalización aplicada;
6. una huella verificable;
7. la relación con revisiones anteriores.

## 4. Definición normativa

Financial Snapshot es una **evidencia financiera derivada e inmutable** que afirma:

> Para este ámbito, instante lógico, versión de contrato, versión de motor, conjunto de reglas y evidencia financiera canonicalizada, Private Balance produjo exactamente este estado financiero.

### 4.1 Lo que sí es

- Un artefacto de dominio sellado.
- Una representación autocontenida o vinculada a evidencia inmutable suficiente para reproducción exacta.
- Una unidad versionada de auditoría financiera.
- Un resultado derivado que puede verificarse sin consultar servicios externos.
- Una base estable para futuras capas, siempre después de validación y promoción explícitas.

### 4.2 Lo que no es

- **No es una caché:** su validez no depende de acelerar una consulta y no se reemplaza silenciosamente.
- **No es un reporte:** no contiene decisiones de presentación, HTML, PDF, etiquetas visuales ni layout.
- **No es una consulta:** no expresa cómo leer el estado vivo ni se reevalúa al consumirse.
- **No es un DTO:** su identidad, invariantes, versionado y evidencia tienen semántica de dominio.
- **No es un backup:** no copia toda la base ni restaura la aplicación.
- **No es un cierre contable:** no bloquea periodos ni modifica mutabilidad.
- **No es un movimiento:** no crea ingresos, gastos o ajustes.
- **No es event sourcing:** no pretende reconstruir todo el libro desde eventos.
- **No es telemetría:** no sustituye logs ni métricas técnicas.
- **No es una fuente alternativa de reglas:** consume Financial Engine; no recalcula por otra ruta.

## 5. Objetivos

1. Representar de manera estable el resultado de Financial Engine para un scope explícito.
2. Preservar evidencia suficiente para reproducir exactamente el estado representado.
3. Detectar cualquier cambio material en evidencia, contexto, reglas, versión o resultado.
4. Diferenciar identidad lógica, revisión, versión de contrato y fingerprint.
5. Evitar que orden incidental de objetos o colecciones cambie la identidad del contenido.
6. Explicar cada métrica sin IA mediante trazas y referencias deterministas.
7. Mantener el proceso completo local y de solo lectura sobre el libro financiero.
8. Permitir evolución compatible y reconstrucciones controladas.
9. Preparar una frontera confiable para capas futuras sin diseñarlas ni implementarlas aquí.
10. Permitir adopción gradual mediante shadow mode y promoción independiente.

## 6. No objetivos

Este milestone no debe:

- crear o modificar movimientos financieros;
- cambiar reglas de ingresos, gastos, ajustes, monedas, duración o temporadas;
- reemplazar legacy como fuente oficial global;
- migrar automáticamente Home, Reports u otros consumidores;
- diseñar recomendaciones;
- diseñar IA generativa, prompts, modelos o embeddings;
- diseñar Rule Registry completo;
- diseñar Knowledge Layer, Insight Engine o Assistant;
- crear sincronización remota;
- crear tablas en Dexie o Neon por efecto de este documento;
- crear eventos, endpoints, workflows o automatizaciones;
- resolver retención remota o distribución multi-dispositivo;
- convertir n8n en motor de cálculo;
- usar notas libres, teléfonos, canales o datos de WhatsApp como evidencia financiera;
- activar scopes sin semántica canónica, como `trip`, antes de que exista su entidad de dominio.

## 7. Principios arquitectónicos

### 7.1 Una sola autoridad de cálculo

Financial Engine es el único productor permitido del estado financiero derivado. Financial Snapshot organiza, canonicaliza, valida y sella su salida; nunca duplica sus fórmulas.

### 7.2 Local-first

La construcción, reproducción, validación y lectura del snapshot deben funcionar localmente. Neon, n8n, Vercel, Evolution API, WhatsApp y un proveedor de IA no son dependencias permitidas del cálculo o sellado.

### 7.3 Solo lectura financiera

Generar un snapshot no puede escribir, corregir, completar, normalizar in-place ni reclasificar el libro financiero. Cualquier normalización necesaria se realiza sobre una proyección derivada e inmutable.

### 7.4 Determinismo fuerte

La misma evidencia relevante, scope, versiones y reglas debe producir:

- el mismo estado financiero;
- el mismo contenido canonicalizado;
- el mismo fingerprint.

### 7.5 Inmutabilidad después del sellado

Un snapshot sellado no se edita. Si cambia cualquier dato material, se produce una revisión nueva que referencia a la anterior.

### 7.6 Evidencia antes que conveniencia

No basta con guardar métricas agregadas. La arquitectura debe preservar la evidencia mínima completa necesaria para recomputarlas o una referencia inmutable y verificable hacia esa evidencia.

### 7.7 Versionado explícito

No existe canonicalización, interpretación o reproducción segura sin conocer la versión del contrato que define su significado.

### 7.8 Privacidad por minimización

Solo se conserva lo que participa materialmente en el cálculo o prueba su contexto. Quedan fuera secretos, licencias, PIN, tokens, QR, pairing codes, owner JID, teléfonos y notas libres salvo que una regla financiera futura, aprobada de forma separada, requiera un campo estructurado específico.

### 7.9 Ausencia no equivale a cero

Campos ausentes, valores nulos, colecciones vacías, datos inválidos y cero financiero deben conservar semánticas distintas cuando afecten reproducción o auditoría.

### 7.10 Errores visibles y no publicables

Un fallo de validación, evidencia incompleta, valor no finito, scope ambiguo o versión desconocida impide sellar o promover el snapshot. No se corrige silenciosamente.

## 8. Estado actualmente implementado [IMPLEMENTADO]

AI Foundation proporciona actualmente:

- `buildBalanceReport`, que conserva la semántica legacy del balance;
- `runFinancialEngine`, adapter determinista y de solo lectura;
- `engineVersion = 1.0.0-phase-1a-minimal`;
- una lista ordenada de IDs de reglas aplicadas;
- métricas de balance, duraciones y conteos;
- filtrado por modo de uso y periodo profesional cuando corresponde;
- reutilización de valores históricos de moneda almacenados;
- `validateFinancialParity`, que compara valores exactos;
- Reports en shadow mode, con legacy siempre oficial;
- un piloto Home limitado al resumen de balance;
- `assessFinancialEnginePromotion`, política de elegibilidad basada en pruebas controladas;
- rollback de Home mediante build/redeploy con el flag desactivado o ausente.

### 8.1 Capacidades que no existen

Actualmente no existen:

- `FinancialSnapshot`;
- builder de snapshots;
- evidencia financiera sellada;
- canonicalización versionada;
- fingerprint de snapshot;
- identidad o revisiones de snapshot;
- persistencia local de snapshots;
- shadow mode de snapshots;
- promotion policy de snapshots;
- Rule Registry formal;
- publicación de snapshots;
- tablas, eventos o workflows de snapshots.

## 9. Relación con AI Foundation

### 9.1 Financial Engine

Financial Engine recibe registros y contexto, reutiliza reglas existentes y produce un resultado determinista. Financial Snapshot debe consumir esa salida sin reinterpretarla.

La frontera es unidireccional:

```text
evidencia financiera de solo lectura
        -> Financial Engine
        -> resultado determinista + reglas conocidas
        -> Snapshot Builder
        -> Canonical Snapshot
```

Snapshot Builder no puede volver a calcular balances, duraciones, conteos, clasificaciones o conversiones.

### 9.2 Shadow Mode

El shadow mode actual compara Financial Engine con legacy y devuelve legacy. En el milestone Snapshot se reutiliza el patrón de adopción, no necesariamente la misma función:

- construir el candidato sin afectar al consumidor;
- validar su contenido y reproducibilidad;
- comparar contra la salida oficial correspondiente;
- registrar divergencias solo en el entorno autorizado;
- devolver o conservar el resultado oficial existente;
- evitar persistencia o promoción mientras exista divergencia.

Shadow mode de Snapshot no significa que el snapshot sea oficial, publicado o persistido.

### 9.3 Promotion Policy

La policy implementada hoy solo evalúa la promoción del consumidor Home. No autoriza snapshots.

Una futura policy de Snapshot deberá evaluar por separado, como mínimo:

- paridad financiera exacta;
- reproducción exacta desde evidencia;
- canonicalización estable;
- fingerprint estable;
- cero mutaciones de entrada;
- cero escrituras financieras;
- cero dependencias de red;
- compatibilidad por modo, moneda y periodo;
- manejo exacto de datos incompletos legacy;
- rollback inmediato del consumidor;
- compatibilidad de versión;
- ausencia de datos prohibidos.

### 9.4 Parity Validator

El validator actual es útil para igualdad exacta y detección de divergencias. No sustituye canonicalización ni validación estructural.

En particular:

- actualmente el orden de arrays es significativo;
- un snapshot debe ordenar colecciones según reglas canónicas antes de comparar o sellar;
- igualdad de objetos no demuestra que exista evidencia suficiente;
- paridad financiera no demuestra integridad del fingerprint;
- logs de divergencia no constituyen auditoría persistente.

## 10. Contrato conceptual

Los siguientes conceptos definen responsabilidades. No representan todavía código.

### 10.1 `FinancialSnapshot`

Artefacto de dominio sellado que agrupa:

- identidad lógica y revisión;
- versión del contrato;
- metadata del scope y generación;
- estado financiero producido por Financial Engine;
- evidencia financiera relevante;
- reglas aplicadas conocidas;
- fingerprints;
- relación con la revisión sustituida;
- estado de ciclo de vida.

Un `FinancialSnapshot` solo merece ese nombre después de validarse y sellarse. Antes de ello es un candidato o draft.

### 10.2 `FinancialSnapshotInput`

Solicitud conceptual de construcción. Define:

- scope y tipo de periodo;
- inicio, fin y semántica de límites;
- instante lógico `asOf`;
- timezone;
- modo de uso;
- moneda de presentación;
- periodo profesional cuando aplique;
- filtros estructurados permitidos;
- versión esperada del contrato;
- fuente de evidencia de solo lectura;
- propósito técnico de generación.

No contiene componentes de UI ni acepta consultas libres.

### 10.3 `FinancialSnapshotMetadata`

Describe el contexto verificable del artefacto:

- identidad lógica del scope;
- `asOf` y periodo representado;
- timezone y política temporal;
- modo, moneda y contexto profesional;
- versión del motor;
- versión de canonicalización;
- versión de contrato;
- instante técnico de generación;
- motivo de generación o revisión;
- calidad, cobertura y advertencias;
- procedencia local autorizada.

El instante técnico de generación pertenece a metadata, pero no debe cambiar el fingerprint del contenido financiero.

### 10.4 `SnapshotVersion`

Identificador obligatorio de la semántica completa del snapshot. Determina:

- campos requeridos y opcionales;
- significado de cada campo;
- política de canonicalización;
- reglas de orden;
- representación de fechas, números, nulos y ausencias;
- composición del fingerprint;
- invariantes de reproducción;
- política de compatibilidad.

No debe confundirse con:

- versión de Financial Engine;
- versión de una regla;
- revisión del mismo snapshot lógico;
- versión de la aplicación.

### 10.5 `SnapshotFingerprint`

Huella determinista del contenido material canonicalizado. Permite verificar que contexto, evidencia, reglas y resultado no cambiaron.

No es identidad de base de datos, firma digital, autorización ni cifrado.

### 10.6 `AppliedRules`

Evidencia ordenada de las reglas que Financial Engine declara haber aplicado. En el estado actual puede conservar:

- ID estable de regla;
- posición canónica;
- versión del motor que declara su aplicación;
- dominio o resultado afectado cuando sea conocido;
- limitación explícita si no existe versión formal de regla.

No debe inventar `ruleVersion`. Hasta que exista Rule Registry, la ausencia de versión formal es parte de la evidencia y de las limitaciones del snapshot.

### 10.7 `FinancialEvidence`

Proyección inmutable de todos y solo los campos que pueden afectar el resultado o demostrar su scope.

Debe incluir conceptualmente:

- referencias estables de registros cuando existan;
- tipo de fuente;
- fecha y pertenencia al scope;
- modo de uso y periodo profesional relevante;
- clasificación financiera utilizada;
- valores históricos de moneda utilizados;
- duración nominal y duración efectiva relevante;
- campos estructurados requeridos por las reglas aplicadas;
- evidencia de inclusión o exclusión;
- conteos y cobertura;
- advertencias por datos incompletos.

La evidencia puede ser:

1. **embebida** en el snapshot como proyección mínima; o
2. **referenciada** mediante un paquete local inmutable y content-addressed.

Una referencia mutable hacia un registro vivo de Dexie no es evidencia suficiente para reproducción histórica.

### 10.8 `CanonicalSnapshot`

Representación normalizada, libre de orden incidental y campos volátiles, lista para fingerprint y sellado.

Incluye el contenido financiero material y excluye envoltorios de persistencia, estado de sincronización, timestamps operativos y datos de UI.

### 10.9 Identidad, clave y revisión

Conceptualmente deben distinguirse:

- **snapshot key:** identifica sujeto local autorizado, scope, periodo, timezone, modo, moneda y filtros relevantes;
- **revision:** secuencia de evidencias distintas para la misma key;
- **snapshot ID:** identidad técnica única del artefacto, definida en una fase posterior;
- **supersedes:** referencia a la revisión inmediatamente anterior;
- **fingerprint:** identidad del contenido material, no de la fila o archivo.

## 11. Invariantes del dominio

Un snapshot sellado debe cumplir simultáneamente:

1. El scope es completo y no ambiguo.
2. `snapshotVersion` es conocido y soportado.
3. La versión del motor está presente.
4. Toda regla declarada tiene un ID estable.
5. La evidencia es suficiente para reproducción exacta.
6. El resultado reproducido coincide exactamente con el sellado.
7. La canonicalización no depende del orden de lectura.
8. El fingerprint coincide con el contenido canonicalizado.
9. No contiene datos prohibidos.
10. No mutó ninguna entrada.
11. No escribió en el libro financiero.
12. No dependió de red o estado de UI.
13. La revisión anterior, si existe, queda referenciada y no modificada.
14. Un snapshot inválido o incompleto no puede promocionarse.

## 12. Ciclo de vida

### 12.1 Nacimiento

Un candidato nace por una solicitud explícita y determinista, nunca como efecto oculto de render de UI. La solicitud fija el scope antes de leer evidencia.

Secuencia conceptual:

1. Validar scope y versión solicitada.
2. Abrir una vista de lectura coherente.
3. Proyectar evidencia financiera relevante.
4. Ejecutar Financial Engine una sola vez sobre esa evidencia.
5. Asociar metadata y reglas aplicadas.
6. Construir el candidato.
7. Canonicalizar.
8. Reproducir y validar invariantes.
9. Calcular fingerprint.
10. Sellar.

### 12.2 Cuándo se genera

Los disparadores iniciales deberán ser explícitos y locales. Posibles casos, sujetos a fase:

- acción manual de prueba o auditoría;
- cierre lógico de una ventana de análisis sin convertirlo en cierre contable;
- ejecución controlada de shadow mode;
- cambio detectado en evidencia relevante;
- reconstrucción solicitada tras una versión nueva;
- preparación de un consumidor aprobado.

No debe generarse automáticamente por cada render, navegación o reintento de red.

### 12.3 Estados conceptuales

```text
requested
    -> building
    -> validated
    -> sealed
    -> persisted [fase posterior]
    -> published [fase posterior]
    -> superseded

requested/building/validated
    -> failed

sealed/persisted
    -> invalidated [solo por evidencia de corrupción o incompatibilidad]
```

`sealed` significa inmutabilidad del contenido. `persisted` indica almacenamiento exitoso. `published` significa que una revisión validada fue admitida como artefacto consumible por capas posteriores; no implica sincronización remota. La **promoción** pertenece a la política de adopción de un productor o consumidor y no es un estado mutable dentro del contenido sellado.

### 12.4 Cuándo nunca se modifica

Desde `sealed`, nunca se cambian:

- evidencia;
- resultado financiero;
- scope;
- versiones;
- reglas aplicadas;
- canonicalización;
- fingerprint;
- referencia histórica.

Metadata operativa externa, como estado de sincronización, debe vivir fuera del contenido sellado.

### 12.5 Reemplazo

Un snapshot no se sobrescribe. Se crea una nueva revisión cuando cambia materialmente:

- una entrada relevante;
- una exclusión relevante;
- el scope;
- la política temporal;
- la moneda o modo;
- la versión del motor;
- una regla aplicada;
- `snapshotVersion`;
- la canonicalización;
- el resultado.

La nueva revisión referencia a la anterior mediante `supersedes`; la anterior pasa a estado `superseded` sin perderse.

### 12.6 Invalidación

Invalidar no equivale a borrar ni recalcular. Indica que el artefacto no debe consumirse como válido por causas como corrupción, versión no soportada, fingerprint incorrecto o evidencia insuficiente descubierta después.

## 13. Versionado

### 13.1 Por qué `snapshotVersion` es obligatorio

Sin versión no puede saberse:

- cómo interpretar un campo;
- si un límite temporal es inclusivo o exclusivo;
- cómo se ordenó una colección;
- cómo se representó un decimal;
- qué campos entraron en el fingerprint;
- si ausencia y `null` eran equivalentes;
- si dos snapshots son comparables;
- cómo reproducir un snapshot antiguo.

Por ello, un snapshot sin versión conocida es inválido, aunque su JSON sea legible.

### 13.2 Tipos de cambio

- **Compatible aditivo:** añade metadata opcional que no cambia significado, canonicalización ni fingerprint material de la versión anterior.
- **Compatible mediante lector:** una versión nueva puede leerse y proyectarse a una vista común sin alterar el artefacto original.
- **Material:** cambia semántica, evidencia requerida, reglas de orden, precisión o composición del fingerprint; exige nueva `snapshotVersion`.
- **Incompatible:** no puede compararse o reproducirse con lectores anteriores; requiere migración por reconstrucción, nunca edición in-place.

### 13.3 Evolución futura

Cada versión deberá publicar conceptualmente:

- esquema semántico;
- invariantes;
- política de canonicalización;
- composición del fingerprint;
- matriz de compatibilidad;
- casos de prueba de referencia;
- procedimiento de lectura y reconstrucción;
- fecha de introducción y estado de soporte.

### 13.4 Compatibilidad

- Un lector debe rechazar versiones desconocidas de forma explícita.
- Un escritor solo produce la versión que declara soportar.
- Snapshots antiguos permanecen inmutables.
- Una versión nueva no reetiqueta artefactos antiguos.
- La actualización se realiza creando una reconstrucción o revisión nueva.
- Comparar versiones distintas exige una política de comparabilidad explícita.

### 13.5 Versiones ortogonales

El snapshot deberá conservar separadamente:

- `snapshotVersion`;
- versión de canonicalización;
- `engineVersion`;
- versiones formales de reglas cuando existan;
- revisión del snapshot;
- versión del fingerprint o dominio de huella si la estrategia evoluciona.

## 14. Fingerprint

### 14.1 Propósito

`SnapshotFingerprint` permite:

- detectar alteraciones;
- reconocer contenido material idéntico;
- verificar reproducción;
- deduplicar candidatos sin borrar revisiones legítimas;
- enlazar evidencia y resultado;
- demostrar que metadata volátil no alteró el estado financiero.

### 14.2 Qué garantiza

Si dos snapshots válidos de la misma versión tienen el mismo fingerprint, deben representar exactamente el mismo contenido financiero material canonicalizado, dentro de las garantías del algoritmo elegido.

El fingerprint no garantiza por sí solo:

- autoría;
- consentimiento;
- autenticidad criptográfica de un dispositivo;
- que el cálculo sea una regla de negocio correcta;
- que el snapshot esté autorizado para un consumidor;
- confidencialidad;
- persistencia exitosa.

### 14.3 Qué debe incluir

Conceptualmente incluye, bajo separación de dominio:

- identificador de `snapshotVersion`;
- versión de canonicalización;
- scope material;
- periodo y `asOf` lógico;
- timezone y modo;
- moneda;
- evidencia financiera canonicalizada o fingerprint verificable de su paquete inmutable;
- resultado de Financial Engine;
- `engineVersion`;
- reglas aplicadas y sus versiones conocidas;
- advertencias materiales de calidad;
- referencia de revisión cuando forme parte de la semántica aprobada.

### 14.4 Qué nunca debe incluir

- instante técnico de generación si no cambia el estado representado;
- duración de ejecución;
- orden de lectura de IndexedDB;
- ID autoincremental de persistencia;
- estado de sincronización;
- reintentos, logs o stack traces;
- versión del navegador o dispositivo;
- feature flags de UI;
- rutas, etiquetas o preferencias visuales;
- secretos, licencias, tokens o credenciales;
- datos WhatsApp;
- notas libres no utilizadas por reglas financieras aprobadas;
- referencias mutables sin fingerprint propio.

### 14.5 Algoritmo conceptual

La operación conceptual será:

```text
material versionado
    -> canonicalización determinista
    -> codificación inequívoca en bytes
    -> separación de dominio Financial Snapshot
    -> función de resumen resistente a colisiones
    -> representación estable del fingerprint
```

Este documento no elige algoritmo concreto, encoding ni longitud. La decisión deberá registrarse antes de implementar la fase de fingerprint.

## 15. Canonicalización

### 15.1 Objetivo

La canonicalización convierte contenido semánticamente equivalente en una única representación. Evita que orden de propiedades, orden incidental de lectura o diferencias de serialización produzcan fingerprints distintos.

### 15.2 Reglas conceptuales

- Ordenar claves de objetos mediante una regla estable definida por versión.
- Ordenar colecciones de evidencia por una clave semántica total y estable.
- Conservar el orden solo cuando sea parte del significado financiero.
- Definir desempates explícitos para registros sin ID o con claves iguales.
- Representar números sin depender de locale ni notación del runtime.
- Preservar exactamente la semántica monetaria vigente; canonicalizar no autoriza redondeos nuevos.
- Rechazar `NaN`, infinitos y valores no representables.
- Normalizar fechas a una forma inequívoca sin perder timezone o fecha lógica.
- Diferenciar campo ausente, `null`, cadena vacía y cero cuando la versión así lo requiera.
- Normalizar strings estructurados solo bajo reglas aprobadas; no modificar notas libres.
- No serializar `undefined` de manera implícita.
- Excluir campos volátiles antes del sellado.

### 15.3 Orden de evidencia

El orden debe derivar de atributos financieros estables, por ejemplo:

```text
tipo de fuente
-> fecha lógica
-> identidad estable
-> clasificación financiera
-> desempate canónico versionado
```

La clave exacta queda pendiente. No se puede depender del orden devuelto por Dexie, de inserción en arrays o de iteración de `Map` si ese orden no está normado.

### 15.4 Canonicalización no es limpieza

Canonicalizar no significa:

- corregir datos legacy;
- completar campos ausentes;
- convertir monedas otra vez;
- sanear negativos;
- redondear con una regla nueva;
- reclasificar ajustes;
- descartar evidencia incómoda.

Los datos incompletos deben conservar su semántica y producir advertencias cuando corresponda.

## 16. Reglas aplicadas

### 16.1 Por qué forman parte de la evidencia

Dos resultados iguales pueden provenir de reglas distintas. Sin evidencia de reglas no puede saberse si el snapshot es reproducible, comparable o históricamente válido.

`AppliedRules` permite responder:

- qué regla participó;
- en qué orden declarado;
- qué parte del resultado afectó;
- bajo qué versión del motor se ejecutó;
- qué limitaciones de versionado existían.

### 16.2 Relación con Financial Engine

Financial Engine es el único componente que declara qué reglas aplicó. Snapshot Builder conserva esa declaración; no la infiere examinando el resultado.

El adapter actual expone IDs como:

- `balance.report.current`;
- `currency.stored_income_value`;
- `currency.stored_expense_value`;
- `income.adjustment_classification`;
- `usage_mode.record_resolution`;
- `duration.effective_financial`.

Estos IDs son evidencia útil, pero no constituyen todavía Rule Registry ni versiones independientes.

### 16.3 Sin crear Rule Registry

Durante el milestone Snapshot:

- se conserva el ID exacto emitido;
- se conserva `engineVersion`;
- se mantiene orden canónico;
- se declara explícitamente si `ruleVersion` no existe;
- no se inventan estados, dependencias o metadatos de reglas;
- no se carga código dinámico;
- no se persisten implementaciones de reglas.

Una integración futura con Rule Registry enriquecerá referencias; no reescribirá snapshots antiguos.

## 17. Financial Evidence y reproducción

### 17.1 Requisito de suficiencia

Un snapshot debe poder reproducirse sin consultar el estado vivo actual. Para ello, `FinancialEvidence` debe contener o referenciar de forma inmutable todos los valores que Financial Engine necesita.

Un conjunto de IDs y un hash no es suficiente: demuestra identidad, pero no permite recomputar.

### 17.2 Evidencia mínima, no base completa

La proyección debe excluir campos que no participan en reglas. Por ejemplo, una etiqueta visual o nota libre no debe copiarse solo porque existe en el registro fuente.

Al mismo tiempo, no puede omitirse un campo que afecte:

- pertenencia a modo o temporada;
- inclusión temporal;
- clasificación ingreso/gasto/ajuste;
- valor histórico de moneda;
- duración financiera;
- cálculo de balance;
- explicación de una exclusión.

### 17.3 Inclusiones y exclusiones

La auditabilidad completa puede requerir dos conjuntos:

- evidencia incluida en el cálculo;
- evidencia candidata excluida, representada de forma mínima junto con un código determinista de exclusión.

La política exacta deberá equilibrar reproducción, privacidad y tamaño. Si las exclusiones no se almacenan, el snapshot debe al menos fijar el universo de entrada mediante una huella reproducible.

### 17.4 Vista coherente

La evidencia debe leerse desde una vista temporalmente coherente. Mezclar ingresos de un instante con gastos de otro puede producir un snapshot internamente imposible aunque cada lectura sea válida por separado.

La técnica concreta para obtener esa vista local se decide en implementación; el contrato exige coherencia y detección de cambios concurrentes.

## 18. Auditabilidad y explicación sin IA

Financial Snapshot debe permitir responder “¿Por qué este balance vale X?” siguiendo una cadena verificable:

```text
balance X
  -> componentes del resultado
  -> reglas aplicadas
  -> evidencia incluida
  -> valores históricos usados
  -> scope y exclusiones
  -> versión de motor y contrato
  -> fingerprint verificable
```

### 18.1 Explicación mínima

Para cada métrica material debe poder identificarse:

- fórmula o regla propietaria conocida;
- entradas agregadas relevantes;
- ajustes positivos y negativos;
- moneda y valores históricos seleccionados;
- modo y periodo;
- registros incluidos y conteos;
- limitaciones por datos ausentes;
- resultado antes y después de ajustes cuando aplique.

### 18.2 Sin narrativa generativa

La explicación se produce mediante:

- códigos de regla;
- campos estructurados;
- trazas deterministas;
- plantillas versionadas futuras;
- relaciones de evidencia.

No requiere LLM, embeddings ni texto inventado. Una futura capa de presentación podrá traducir la evidencia a lenguaje natural, pero nunca cambiar su significado.

### 18.3 Prueba de reproducción

La validación ideal debe poder:

1. leer la evidencia sellada;
2. reconstruir la entrada compatible de Financial Engine;
3. ejecutar la versión soportada del motor;
4. comparar exactamente el resultado;
5. recanonicalizar;
6. recalcular el fingerprint;
7. confirmar igualdad total.

## 19. Arquitectura lógica

```text
┌──────────────────────────────────────────────────────────┐
│ Dexie / IndexedDB [IMPLEMENTADO]                         │
│ Libro financiero operativo canónico                     │
└───────────────────────────┬──────────────────────────────┘
                            │ vista coherente, solo lectura
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Financial Evidence Projector [OBJETIVO DEL MILESTONE]   │
│ proyección mínima · inclusiones · exclusiones · calidad  │
└───────────────────────────┬──────────────────────────────┘
                            │ evidencia inmutable candidata
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Financial Engine [IMPLEMENTADO PARCIALMENTE]             │
│ reglas existentes · cálculo determinista · engineVersion │
└───────────────────────────┬──────────────────────────────┘
                            │ resultado + appliedRules
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Snapshot Builder [OBJETIVO DEL MILESTONE]                │
│ scope · metadata · evidencia · resultado · revisión      │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Canonicalizer [OBJETIVO DEL MILESTONE]                   │
│ orden estable · representación versionada · validación   │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Fingerprint + Seal [OBJETIVO DEL MILESTONE]              │
│ huella material · invariantes · inmutabilidad            │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Canonical Financial Snapshot [OBJETIVO DEL MILESTONE]   │
│ evidencia financiera reproducible y versionada           │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
                │ shadow/promotion          │ persistencia local futura
                ▼                           ▼
┌──────────────────────────────┐  ┌─────────────────────────┐
│ Consumidor aprobado [FUTURO] │  │ Snapshot Store [FUTURO]│
└──────────────────────────────┘  └─────────────────────────┘
```

### 19.1 Dependencias permitidas

- lecturas locales coherentes;
- Financial Engine;
- helpers financieros ya caracterizados;
- validator de paridad como herramienta auxiliar;
- canonicalización y fingerprint locales versionados;
- reloj inyectable o instante explícito para metadata.

### 19.2 Dependencias prohibidas

- n8n, Neon, Evolution API y WhatsApp;
- APIs de IA;
- estado mutable de UI;
- tasas actuales para recalcular historia;
- reglas financieras duplicadas;
- orden accidental del almacenamiento;
- red como condición de éxito;
- secretos o identidad de canal.

## 20. Relación futura con AI Core

La cadena futura es unidireccional:

```text
Financial Snapshot
        │ evidencia financiera publicada
        ▼
Rule Registry
        │ referencias de reglas versionadas
        ▼
Knowledge Layer
        │ hechos derivados con evidencia
        ▼
Insight Engine
        │ observaciones deterministas
        ▼
LLM Assistant
        │ explicación opcional sin autoridad financiera
```

Este diagrama expresa dependencias conceptuales futuras, no orden de implementación interna ni componentes existentes.

### 20.1 Financial Snapshot

Conserva evidencia y estado financiero derivado. No produce conocimiento, anomalías, recomendaciones o narrativa.

### 20.2 Rule Registry [FUTURO]

Gobernará versiones y metadatos de reglas. Snapshot solo conservará referencias verificables. Este documento no diseña el registro completo.

### 20.3 Knowledge Layer [FUTURO]

Derivará hechos desde snapshots válidos y publicados, nunca desde movimientos directos. No forma parte de este milestone.

### 20.4 Insight Engine [FUTURO]

Interpretará snapshots y conocimiento mediante reglas deterministas. No accederá directamente a Dexie ni alterará snapshots.

### 20.5 LLM Assistant [FUTURO Y OPCIONAL]

Solo podría explicar artefactos estructurados ya validados. No calculará, corregirá, recomendará ni será fuente de verdad. Su diseño queda expresamente fuera de alcance.

## 21. Persistencia [PENDIENTE DE DECISIÓN]

La persistencia no forma parte de las primeras fases del milestone y este documento no modifica Dexie.

Cuando se autorice, deberá cumplir:

- local-first como almacenamiento operativo inicial;
- append-only para contenido sellado;
- índice por key, revisión, periodo, versión y fingerprint;
- separación entre contenido sellado y metadata operacional mutable;
- transacción que evite artefactos parciales;
- verificación al leer;
- integración explícita con backup y restore;
- política de retención aprobada;
- ninguna dependencia obligatoria de Neon.

Una eventual réplica remota sería secundaria, minimizada y verificable. Nunca convertiría Neon en libro financiero ni autorizaría cálculo remoto.

## 22. Seguridad y privacidad

### 22.1 Clasificación

Un snapshot contiene información financiera sensible aunque esté agregada. Debe heredar las protecciones del almacenamiento local y no exponerse a logs o eventos por defecto.

### 22.2 Minimización

- Conservar solo evidencia material.
- Evitar notas libres.
- No incluir credenciales ni identidad de comunicación.
- No copiar configuración completa cuando basten campos financieros específicos.
- No incluir datos de licencia o dispositivo salvo una identidad local seudónima aprobada para keying.

### 22.3 Integridad frente a autenticidad

El fingerprint detecta cambios accidentales o deliberados en contenido. No prueba quién creó el snapshot. Si en el futuro se requiere autenticidad criptográfica o intercambio entre dispositivos, deberá diseñarse firma y gestión de claves en una iniciativa separada.

## 23. Riesgos y mitigaciones

### 23.1 Segunda fuente de verdad

- **Riesgo:** implementar fórmulas dentro de Snapshot Builder.
- **Mitigación:** Financial Engine es el único productor de resultados; builder solo ensambla y sella.

### 23.2 Evidencia insuficiente

- **Riesgo:** almacenar totales y hashes sin datos reproducibles.
- **Mitigación:** prueba obligatoria de reproducción desde `FinancialEvidence` antes del sellado.

### 23.3 Evidencia excesiva

- **Riesgo:** convertir cada snapshot en copia completa y sensible de Dexie.
- **Mitigación:** proyección mínima por reglas, privacy review y exclusión de campos no materiales.

### 23.4 Lecturas inconsistentes

- **Riesgo:** fuentes cambian durante la construcción.
- **Mitigación:** vista coherente o detección de cambio antes de sellar.

### 23.5 Orden no determinista

- **Riesgo:** mismo dataset produce fingerprint distinto.
- **Mitigación:** canonicalización versionada y pruebas con permutaciones.

### 23.6 Identidades ausentes o inestables

- **Riesgo:** registros legacy sin ID impiden desempate estable.
- **Mitigación:** política canónica explícita y decisión previa sobre identidad de evidencia.

### 23.7 Precisión numérica

- **Riesgo:** serialización o normalización introduce una regla de redondeo nueva.
- **Mitigación:** preservar valores/resultados del motor y versionar la representación numérica.

### 23.8 Cambio de reglas sin versiones formales

- **Riesgo:** un ID de regla conserva nombre pero cambia comportamiento.
- **Mitigación:** conservar `engineVersion`, bloquear afirmaciones de reproducibilidad más allá del runtime soportado y formalizar versionado antes de promoción durable.

### 23.9 Crecimiento append-only

- **Riesgo:** revisiones ilimitadas consumen almacenamiento local.
- **Mitigación:** política de retención que nunca borre evidencia necesaria sin exportación o decisión explícita.

### 23.10 Confusión con cierre o reporte

- **Riesgo:** UI o negocio trata snapshot como bloqueo contable o documento visual.
- **Mitigación:** contratos separados y nomenclatura normativa.

### 23.11 Feature flags ambientales

- **Riesgo:** resultados distintos según entorno no declarado.
- **Mitigación:** flags gobiernan promoción del consumidor, nunca contenido del cálculo; el snapshot registra versiones materiales, no configuración visual.

### 23.12 Corrupción o restauración

- **Riesgo:** backup parcial rompe la cadena de revisiones.
- **Mitigación:** verificación de fingerprints, importación transaccional y política de referencias antes de persistir.

## 24. Decisiones arquitectónicas justificadas

### 24.1 Evidencia derivada, no autoridad operativa

Mantiene Dexie como libro canónico y evita competir con movimientos reales.

### 24.2 Resultado producido exclusivamente por Financial Engine

Evita duplicación de fórmulas y preserva la paridad lograda por AI Foundation.

### 24.3 Evidencia reproducible obligatoria

Un total sin entradas verificables es un reporte histórico, no una evidencia capaz de reconstrucción exacta.

### 24.4 Inmutabilidad desde el sellado

La edición in-place destruye auditabilidad. Revisiones append-only preservan qué se sabía y calculó en cada instante.

### 24.5 Versiones separadas

Contrato, canonicalización, motor, reglas y revisión evolucionan por motivos distintos. Fusionarlos haría imposible diagnosticar diferencias.

### 24.6 Canonicalización antes del fingerprint

Hashear serialización incidental confunde cambios de orden con cambios financieros.

### 24.7 Persistencia aplazada

Primero debe probarse modelo, reproducción y huella en memoria. Persistir un contrato inestable crea deuda de migración y riesgo histórico.

### 24.8 Promoción por consumidor

La validez técnica del snapshot no autoriza reemplazo global. Cada consumidor necesita criterios y rollback propios.

## 25. Decisiones abiertas

Antes de sus fases correspondientes deben resolverse:

1. Semántica inclusiva o exclusiva de `periodEnd`.
2. Definición de semana y primer día según timezone/localidad.
3. Modelo exacto de `asOf` y reloj lógico.
4. Primera lista de scopes soportados; `trip` permanece reservado.
5. Identidad estable de registros legacy sin ID.
6. Clave total para ordenar evidencia y desempatar duplicados.
7. Representación canonical de números y dinero.
8. Representación canonical de fecha, fecha-hora y timezone.
9. Diferencia normativa entre ausente, `undefined`, `null` y vacío.
10. Algoritmo, encoding y formato del fingerprint.
11. Si la evidencia se embebe o usa paquetes locales content-addressed.
12. Política para evidencia excluida y universo de entrada.
13. Formato de snapshot key e identidad técnica.
14. Inicio y reglas de numeración de revisiones.
15. Política de reconstrucción al cambiar motor o snapshotVersion.
16. Matriz de comparabilidad entre versiones.
17. Persistencia local concreta y migración Dexie, si se autoriza.
18. Integración con backup, restore y exportación.
19. Retención, compactación y eliminación autorizada.
20. Estrategia para conservar runtimes o reglas capaces de reproducir historia.
21. Política de invalidación y recuperación ante corrupción.
22. Alcance de telemetría sin datos financieros.
23. Primer consumidor candidato para shadow mode de Snapshot.
24. Criterios formales de promotion policy de Snapshot.
25. Necesidad futura de firma/autenticidad, separada del fingerprint.

## 26. Roadmap incremental

Cada fase debe poder revisarse, probarse y revertirse sin obligar a ejecutar la siguiente.

### Fase 0 — Cierre de decisiones

- Resolver límites temporales, scope inicial, números, fechas e identidad.
- Aprobar ADRs necesarias.
- Congelar contrato conceptual v1.
- Confirmar qué evidencia exacta consume el motor actual.

**Salida:** especificación implementable, todavía sin código de snapshot.

### Fase 1 — Modelo conceptual ejecutable

- Materializar únicamente el modelo in-memory.
- Separar input, metadata, evidence, result y version.
- Validar invariantes estructurales.
- No persistir ni integrar UI.

**Gate:** ningún cálculo nuevo y entradas readonly.

### Fase 2 — Builder determinista

- Construir candidatos desde Financial Engine.
- Capturar `engineVersion` y `appliedRules` reales.
- Preservar el resultado sin reinterpretación.
- Fallar ante scope ambiguo o evidencia insuficiente.

**Gate:** igualdad exacta con la salida del motor y cero mutaciones.

### Fase 3 — Canonicalización

- Implementar versión de canonicalización aprobada.
- Ordenar evidencia y contenido material.
- Probar permutaciones, ausencias, fechas, números y legacy incompleto.

**Gate:** entradas semánticamente iguales producen bytes canónicos iguales.

### Fase 4 — Fingerprint y sellado

- Implementar algoritmo aprobado.
- Aplicar separación de dominio y versión.
- Verificar alteraciones de cada campo material.
- Definir transición candidato -> sealed.

**Gate:** reproducción exacta y huella estable; campos volátiles no cambian la huella.

### Fase 5 — Persistencia local

- Solo después de autorización explícita para Dexie.
- Diseñar tabla, índices y transacción append-only.
- Integrar backup/restore sin pérdida histórica.
- Verificar lectura y corrupción.

**Gate:** persistencia no modifica movimientos y mantiene cadena de revisiones.

### Fase 6 — Shadow Mode de Snapshot

- Elegir un consumidor de solo lectura equivalente.
- Construir snapshots sin cambiar resultado visible.
- Comparar resultado, reproducción, canonicalización y fingerprint.
- Mantener legacy oficial.

**Gate:** paridad sostenida en casos aprobados y fallos aislados.

### Fase 7 — Promotion Policy

- Definir criterios específicos del consumidor.
- Exigir paridad exacta, reproducción, privacidad y rollback.
- Añadir flag aislado si corresponde.
- No promover globalmente.

**Gate:** aprobación explícita y rollback probado por rebuild/redeploy o mecanismo autorizado.

### Fase 8 — Promoción controlada

- Promover un único consumidor de lectura.
- Mantener fallback inmediato.
- Documentar estado real y límites.
- No activar capas futuras.

**Gate:** release review independiente.

## 27. Compatibilidad con AI Foundation

Financial Snapshot reutiliza directamente los logros de AI Foundation:

- reglas puras existentes;
- `buildBalanceReport` como semántica financiera reutilizada;
- adapter determinista;
- engine versionado;
- IDs ordenados de reglas aplicadas;
- exactitud de paridad;
- aislamiento de fallos;
- patrón de shadow mode;
- promotion policy basada en criterios;
- fallback legacy;
- adopción por consumidor.

No crea una segunda fuente de verdad porque:

1. Dexie conserva movimientos canónicos.
2. Financial Engine conserva autoridad exclusiva sobre el cálculo derivado.
3. Snapshot Builder no contiene fórmulas.
4. El snapshot conserva evidencia y resultado; no decide reglas.
5. Legacy sigue oficial hasta promoción explícita de un consumidor.
6. Una eventual persistencia es derivada y reconstruible.

## 28. Checklist de implementación

### 28.1 Alcance y gobierno

- [ ] Existe autorización explícita para la fase concreta.
- [ ] No se mezclan fases posteriores.
- [ ] Constitución, ADRs y AI Core siguen alineados.
- [ ] Estado implementado y objetivo están diferenciados.
- [ ] No se añaden reglas financieras nuevas.

### 28.2 Contrato

- [ ] Scope no ambiguo.
- [ ] `snapshotVersion` obligatorio.
- [ ] `engineVersion` conservado.
- [ ] Canonicalization version definida.
- [ ] Revisión separada de versión.
- [ ] Ausencia, nulo, vacío y cero definidos.
- [ ] Periodo, timezone y `asOf` definidos.

### 28.3 Evidencia

- [ ] Todos los campos materiales están presentes.
- [ ] Campos no materiales y sensibles están excluidos.
- [ ] Evidencia incluida y excluida tiene política explícita.
- [ ] La evidencia no depende de referencias mutables.
- [ ] Puede reproducirse sin red ni estado vivo actual.
- [ ] La vista de lectura es coherente.

### 28.4 Determinismo

- [ ] Permutaciones producen el mismo canonical snapshot.
- [ ] Mismos inputs producen mismo resultado y fingerprint.
- [ ] Números y fechas tienen representación inequívoca.
- [ ] Valores no finitos se rechazan.
- [ ] No existe dependencia de locale, dispositivo o UI.

### 28.5 Reglas y cálculo

- [ ] Financial Engine es el único productor del resultado.
- [ ] Builder no duplica fórmulas.
- [ ] AppliedRules procede del motor.
- [ ] No se inventan versiones de reglas.
- [ ] Paridad exacta con comportamiento legacy aplicable.
- [ ] Datos legacy incompletos mantienen comportamiento caracterizado.

### 28.6 Inmutabilidad y fingerprint

- [ ] Solo contenido validated puede sellarse.
- [ ] El contenido sellado nunca se edita.
- [ ] Cada cambio material altera el fingerprint.
- [ ] Metadata volátil no altera el fingerprint.
- [ ] La reproducción recalcula la misma huella.
- [ ] Revisiones enlazan sin sobrescribir historia.

### 28.7 Seguridad y privacidad

- [ ] No hay secretos, licencias, PIN o tokens.
- [ ] No hay datos WhatsApp o canales.
- [ ] No hay notas libres innecesarias.
- [ ] No hay logging de contenido financiero completo.
- [ ] No hay llamadas externas.
- [ ] La persistencia, si se autoriza, hereda protección local.

### 28.8 Adopción

- [ ] Shadow mode no cambia resultados visibles.
- [ ] Fallos se aíslan y legacy permanece disponible.
- [ ] Promotion policy es específica del consumidor.
- [ ] Rollback está probado y documentado.
- [ ] No hay promoción global implícita.

### 28.9 Persistencia futura

- [ ] Existe autorización explícita para modificar Dexie.
- [ ] Es append-only y transaccional.
- [ ] Backup y restore se actualizan conjuntamente.
- [ ] Fingerprints se verifican al leer/importar.
- [ ] Retención y corrupción tienen política.
- [ ] Neon no se convierte en dependencia ni fuente canónica.

### 28.10 Validación de cierre

- [ ] Tests de contrato, determinismo y reproducción completos.
- [ ] Tests de permutación y mutación completos.
- [ ] Tests de Básico, Profesional, temporada, moneda histórica y ajustes.
- [ ] Tests de dataset vacío, incompleto e inválido.
- [ ] Build correcto.
- [ ] Lint del milestone limpio.
- [ ] `git diff --check` correcto.
- [ ] Documentación refleja el estado real.
- [ ] No se modificó infraestructura externa.

## 29. Criterios de aceptación arquitectónicos

Financial Snapshot estará listo para iniciar implementación cuando:

- se hayan resuelto las decisiones bloqueantes de Fase 0;
- el contrato distinga versión, revisión, engine y reglas;
- la evidencia permita reproducción exacta;
- la canonicalización sea inequívoca;
- el fingerprint tenga composición aprobada;
- no exista una fórmula fuera de Financial Engine;
- la adopción sea incremental y reversible;
- persistencia y sincronización permanezcan desacopladas;
- privacidad y tamaño tengan límites verificables;
- un snapshot inválido no pueda sellarse o promoverse.

## 30. Relación con la documentación existente

### `PRIVATE_BALANCE_CONSTITUTION.md`

Conserva autoridad superior. Financial Snapshot desarrolla reproducibilidad, auditabilidad, local-first y prohibición de alterar historia.

### `01_ARCHITECTURE.md`

Describe la arquitectura realmente implementada. Financial Snapshot no deberá aparecer allí como implementado hasta completar su runtime y validación.

### `02_BUSINESS_RULES.md`

Conserva las reglas financieras vigentes. Este documento no añade ni modifica ninguna.

### `09_AI_CORE_ARCHITECTURE.md`

Define el marco completo. Este documento concreta su componente Financial Snapshot y debe interpretarse dentro de sus límites.

### `DECISIONS.md`

Las decisiones bloqueantes que adquieran carácter vinculante deberán convertirse en ADRs antes de su implementación.

### `AUTOMATION_HUB.md`

Permanece fuera del cálculo y sellado. Una integración remota futura usaría su frontera segura, pero no forma parte de este milestone.

## 31. Decisión arquitectónica final

Financial Snapshot se define como evidencia financiera derivada, determinísticamente construida desde Financial Engine, canonicalizada, versionada, reproducible, auditable e inmutable después del sellado.

La cadena de autoridad queda fijada así:

```text
Dexie
    libro financiero operativo canónico

Financial Engine
    única autoridad del cálculo derivado

Financial Snapshot
    evidencia sellada del resultado y sus entradas materiales
```

Financial Snapshot no crea una nueva contabilidad, no sustituye el libro local, no modifica movimientos y no autoriza capas futuras. Su primera implementación debe empezar por modelo, builder y reproducción en memoria; canonicalización, fingerprint, persistencia, shadow mode y promoción avanzarán únicamente mediante fases separadas y verificables.

## 32. Estado implementado — Milestone 4A

Financial Snapshot dispone de un primer shadow mode observacional local integrado exclusivamente en `homeBalanceSummaryService`, para el resumen del mes actual. Home fue elegido porque el servicio ya recibe el dataset financiero completo, moneda, modo, periodo profesional y el resultado de Financial Engine puede reutilizarse sin otra lectura ni cálculo. Reports conserva su comportamiento actual.

El scope inicial es `monthly`, con intervalo `[periodStart, periodEndExclusive)`, `asOf`, timezone IANA, modo, moneda y `earningPeriodId` profesional explícitos. Los instantes de generación, sellado y persistencia son entradas; el servicio no consulta reloj.

La ejecución requiere el valor de build exacto `VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED=true`. Ausencia, `false` o cualquier otro texto la desactivan. El pipeline construye evidencia embebida mínima desde el dataset ya cargado, reutiliza el resultado de Financial Engine, valida, canonicaliza, calcula fingerprint, deriva key, sella, persiste mediante `FinancialSnapshotRepository` y compara metadata segura con la revisión previa.

El fingerprint y el repository proporcionan idempotencia durable; una promesa en curso evita duplicados simultáneos dentro del ciclo de carga. Contenido idéntico reutiliza la revisión existente y contenido materialmente distinto crea la siguiente revisión enlazada por `supersedes`.

Los fallos se aíslan y no cambian el retorno de Home. Solo desarrollo registra metadata observacional minimizada; producción no registra ni envía telemetría. Financial Snapshot continúa sin ser fuente oficial y no existe Promotion Policy de Snapshot en este milestone.

## 33. Estado implementado — Milestone 4B

`assessSnapshotPromotion` es una policy pura y determinista que evalúa un `SealedFinancialSnapshot` sin promoverlo, persistir decisiones ni consultar almacenamiento. Produce checks estructurados, checks fallidos y warnings; todos los checks obligatorios deben aprobar para obtener `eligible = true`. No existe score ni compensación entre fallos.

La evaluación cubre fingerprint estructural y versiones soportadas, identidad, estado, revisión, coherencia interna de `supersedes`, scope, metadata, evidencia embebida, conteos, reglas conocidas y ordenadas, documento canónico, valores permitidos y coherencia de las copias materiales del snapshot.

Por prohibición del milestone, la policy no recalcula fingerprint ni canonicaliza. Tampoco consulta el repository; por tanto, no afirma existencia real del predecesor, idempotencia durable o ausencia de conflictos concurrentes. Estas limitaciones aparecen como warnings deterministas. La evaluación no modifica consumidores y no constituye promoción automática.

## 34. Estado implementado — Milestone 4C

`SnapshotPromotionExecutor` incorpora un piloto controlado y reversible exclusivamente para el resumen del mes actual de Home. Financial Snapshot no pasa a ser fuente global y no existe promoción automática. Reports y las cards que usan `calculateFinancialTotals` conservan su comportamiento.

La lectura como fuente requiere el valor de build exacto `VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED=true`. Ausencia, `false` o cualquier otro texto mantienen el resultado oficial vigente. El rollback consiste en desactivar el flag y ejecutar build y redeploy; no hay estado de promoción persistido, UI administrativa ni activación remota.

Antes de seleccionar un snapshot, el executor conserva el resultado actual como fallback, deriva el `snapshotKey` del scope solicitado, lee la cadena completa y su última revisión, comprueba continuidad y `supersedes`, recalcula SHA-256 sobre el documento canónico, valida identidad y copias indexadas, compara scope y versiones, y exige `assessSnapshotPromotion(...).eligible === true`. Solo entonces devuelve una copia del `engineResult` persistido. Cualquier ausencia, incompatibilidad, corrupción, excepción o error de repository devuelve el resultado actual.

La ejecución es local y de solo lectura. No construye snapshots, no persiste decisiones, no altera registros financieros y no usa Neon, n8n, workflows, WhatsApp ni red. Los logs se limitan en desarrollo a metadata segura y están desactivados en producción. Shadow Mode puede coexistir con este piloto porque conserva un flag y una responsabilidad independientes.

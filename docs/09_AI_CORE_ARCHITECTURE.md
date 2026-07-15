# 09 — AI Core Architecture

> **ADVERTENCIA — ARQUITECTURA OBJETIVO**
>
> **Este documento describe la arquitectura objetivo aprobada del AI Core. No implica que sus tablas, workflows o componentes estén implementados.**

## 1. Estado del documento

- **Tipo:** arquitectura objetivo de referencia.
- **Estado:** aprobada para planificación incremental.
- **Ámbito:** AI Core / Plataforma Inteligente de Private Balance.
- **Implementación:** pendiente, salvo las capacidades actuales identificadas expresamente como implementadas.
- **Autoridad superior:** `PRIVATE_BALANCE_CONSTITUTION.md` y ADRs aceptadas en `DECISIONS.md`.

Este documento define el destino arquitectónico del AI Core. No autoriza por sí mismo cambios de código, tablas, Neon, n8n, Evolution API, workflows ni comportamiento financiero. Cada fase requerirá alcance, autorización, implementación y verificación independientes.

### 1.1 Convenciones de estado

Para evitar confundir arquitectura con realidad operativa, se utilizan estas etiquetas:

- **[IMPLEMENTADO]:** existe actualmente y está respaldado por código o documentación operativa vigente.
- **[OBJETIVO APROBADO]:** decisión arquitectónica aprobada, todavía no necesariamente implementada.
- **[FUTURO]:** componente, tabla, evento o workflow previsto para una fase posterior.
- **[PENDIENTE DE DECISIÓN]:** requiere una ADR, contrato o definición adicional.
- **[NO DESPLEGADO]:** no debe asumirse disponible en producción.

## 2. Propósito y alcance

El AI Core será la plataforma de análisis determinista, conocimiento derivado e insights explicables de Private Balance. Transformará datos financieros canónicos en:

- snapshots financieros reproducibles;
- conocimiento derivado versionado;
- observaciones deterministas;
- anomalías explicables;
- comparativas auditables;
- notificaciones controladas.

El AI Core no es un nuevo sistema contable, no sustituye el libro financiero local y no modifica movimientos. La IA generativa queda fuera de las primeras fases.

La arquitectura se organiza en cinco componentes independientes:

1. Financial Engine.
2. Financial Snapshot.
3. Rule Registry.
4. Knowledge Layer.
5. Insight Engine.

Notification Center administra la presentación y entrega de sus artefactos, sin formar parte del cálculo financiero.

## 3. Estado actual de Private Balance [IMPLEMENTADO]

Private Balance utiliza actualmente:

- React y TypeScript;
- PWA y APK mediante Capacitor;
- IndexedDB mediante Dexie como persistencia financiera local;
- Vercel Functions como frontera serverless;
- n8n como motor de automatización;
- Neon PostgreSQL para licencias, dispositivos, canales y soporte de automatización;
- Evolution API como proveedor de WhatsApp;
- MCP para auditoría y desarrollo, no como runtime;
- `processed_events` como barrera versionada de idempotencia para automatizaciones.

La persistencia financiera canónica reside en Dexie, principalmente en:

- `services`;
- `expenses`;
- `appointments`;
- `settings`;
- `exchangeRates`;
- `cutoffReports`;
- `earningPeriods`.

La automatización actual sigue esta ruta:

```text
Dexie + automationOutbox
        -> Automation Gateway en Vercel
        -> n8n
        -> Neon / Evolution API / WhatsApp
```

Los eventos actuales incluyen `income.created`, `expense.created`, `calendar.created`, `service.completed` y eventos de dispositivo y comunicación. Este conjunto no constituye un historial completo de event sourcing porque no representa todavía todas las actualizaciones y eliminaciones.

No existe actualmente un runtime de IA generativa en producción. Financial Engine cuenta con una implementación inicial limitada: adaptador determinista de solo lectura, caracterización de paridad, Reports en shadow mode y un piloto del resumen de balance de Home. No constituye todavía una fuente financiera global ni el subsistema completo descrito por la arquitectura objetivo.

### 3.1 Piloto AI Foundation [IMPLEMENTADO]

- **Reports:** ejecuta Financial Engine en shadow mode y devuelve siempre el resultado legacy oficial.
- **Home:** únicamente el resumen de balance puede devolver el resultado del adaptador cuando el build de Vite contiene el texto exacto `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- **Reports Snapshot Pilot:** para el reporte mensual actual, Reports puede consumir la última revisión elegible de Financial Snapshot cuando el build de Vite contiene exactamente `VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED=true`; ante cualquier fallo, incompatibilidad o ausencia, Reports mantiene su flujo actual (fail-closed).
- **Aislamiento del flag:** ausencia, `false` o cualquier valor distinto del texto exacto `true` mantienen legacy. No existe override programático.
- **Rollback:** el flag se incorpora en build time; desactivarlo exige un nuevo build y redeploy. No requiere migración ni limpieza de datos.
- **Autoridad:** legacy sigue siendo la fuente oficial por defecto. Financial Engine no es fuente global y no se han migrado nuevos consumidores.

Financial Snapshot, Rule Registry, Knowledge Layer e Insight Engine no están implementados. Sus contratos, persistencia y runtimes descritos más adelante son exclusivamente arquitectura objetivo.

## 4. Principios arquitectónicos [OBJETIVO APROBADO]

### 4.1 Local-first

Dexie continúa siendo la fuente canónica de los datos financieros operativos. La generación local de artefactos no debe depender de Neon, n8n, Evolution API ni proveedores de IA.

### 4.2 Cálculos financieros canónicos

El AI Core no define fórmulas financieras alternativas. Financial Engine reutilizará exclusivamente:

- valores financieros ya almacenados;
- conversiones históricas almacenadas;
- selectores financieros existentes;
- clasificadores actuales de ingresos, gastos y ajustes;
- lógica vigente de reportes y periodos;
- reglas actuales de modo Básico y Profesional.

Una nueva regla financiera no podrá introducirse como detalle incidental del AI Core. Requerirá decisión, pruebas y autorización específicas.

### 4.3 Separación semántica

- Un **movimiento** es un registro financiero canónico.
- Una **regla** es una transformación determinista registrada.
- Un **snapshot** representa métricas para un ámbito y periodo.
- Una **unidad de conocimiento** representa un hecho derivado.
- Un **insight** interpreta snapshots y conocimiento mediante reglas explícitas.
- Una **notificación** entrega un artefacto previamente generado.
- Un **evento de automatización** transporta una acción entre componentes.

Ninguno de estos conceptos sustituye a otro.

### 4.4 Determinismo

Las mismas entradas, contexto y versiones de reglas deben producir el mismo resultado normalizado y el mismo hash.

### 4.5 Append-only

Los snapshots, unidades de conocimiento e insights publicados no se sobrescriben silenciosamente. Una corrección genera una revisión que referencia a la anterior.

### 4.6 Explicabilidad y auditoría

Todo resultado debe identificar reglas, versiones, periodo, contexto, evidencia, limitaciones, hashes y artefactos sustituidos.

### 4.7 Privacidad por diseño

Solo se procesarán o sincronizarán datos necesarios. Quedan excluidos por defecto notas libres, QR, pairing codes, teléfonos, owner JID, PIN, licencias, tokens, secretos y credenciales.

### 4.8 Sin escritura financiera

Ningún componente del AI Core puede crear, modificar o eliminar ingresos, gastos, ajustes, citas, temporadas, tasas históricas o balances.

### 4.9 n8n como orquestador

n8n puede validar, persistir, enrutar y entregar artefactos. No puede calcular balances, reclasificar ajustes, convertir monedas ni sustituir Financial Engine.

### 4.10 IA generativa fuera del núcleo

Un LLM futuro será opcional, no canónico y sin autoridad de escritura. Nunca sustituirá Rule Registry ni será fuente de verdad financiera.

## 5. Arquitectura lógica completa [OBJETIVO APROBADO]

```text
┌──────────────────────────────────────────────────────────┐
│ Dexie / IndexedDB [IMPLEMENTADO]                         │
│ Fuente financiera canónica                              │
│ services · expenses · appointments · earningPeriods      │
│ settings · exchangeRates · cutoffReports                 │
└───────────────────────────┬──────────────────────────────┘
                            │ lectura de solo lectura
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Financial Engine [FUTURO]                               │
│ Adaptadores canónicos + ejecución determinista           │
└───────────────────────────┬──────────────────────────────┘
                            │ Snapshot Draft
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Financial Snapshot [FUTURO]                             │
│ daily · weekly · monthly · season · trip · year · custom │
│ versionado · revisiones · append-only · hashes           │
└───────────────────────────┬──────────────────────────────┘
                            │ hechos agregados
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Knowledge Layer [FUTURO]                                │
│ hechos derivados · vigencia · evidencia · privacidad     │
└───────────────────────────┬──────────────────────────────┘
                            │ conocimiento vigente
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Insight Engine [FUTURO]                                 │
│ observaciones · anomalías · comparativas                 │
└───────────────────────────┬──────────────────────────────┘
                            │ artefactos publicables
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Notification Center [FUTURO]                            │
│ draft · approval · ready · processing · sent · failed    │
└───────────────────────────┬──────────────────────────────┘
                            │ eventos minimizados
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Automation Gateway [IMPLEMENTADO; EXTENSIÓN FUTURA]      │
│ autenticación · validación · normalización · eventId      │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ n8n [IMPLEMENTADO; WORKFLOWS AI CORE FUTUROS]            │
│ idempotencia · orquestación · persistencia · entrega      │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Neon PostgreSQL [IMPLEMENTADO; TABLAS AI CORE FUTURAS]   │
│ auditoría · artefactos sincronizados · notification outbox│
└───────────────────────────┬──────────────────────────────┘
                            │ resolución contextual
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Evolution API [IMPLEMENTADO]                            │
│ entrega WhatsApp autorizada                              │
└──────────────────────────────────────────────────────────┘
```

Rule Registry es una dependencia transversal:

```text
                         ┌───────────────────────┐
                         │ Rule Registry         │
                         │ [FUTURO]              │
                         └─────┬─────┬─────┬─────┘
                               │     │     │
                 ┌─────────────┘     │     └──────────────┐
                 ▼                   ▼                    ▼
        Financial Engine     Knowledge Layer       Insight Engine
```

## 6. Financial Engine [OBJETIVO APROBADO — NO DESPLEGADO COMO SUBSISTEMA GLOBAL]

La implementación inicial indicada en 3.1 valida un adaptador y dos fronteras controladas, pero no materializa todavía este componente objetivo completo ni cambia la fuente oficial global.

### 6.1 Responsabilidades

- Obtener una vista consistente y de solo lectura.
- Normalizar el contexto del análisis.
- Reutilizar la lógica financiera existente.
- Ejecutar reglas activas de Rule Registry.
- Producir un `Snapshot Draft` normalizado.
- Generar trazabilidad, conteos, advertencias y huellas de entrada.
- Rechazar contextos ambiguos o incompatibles.

### 6.2 Límites

Financial Engine termina al producir un `Snapshot Draft`. No publica, sincroniza, notifica, resuelve canales ni llama a servicios externos.

### 6.3 Entradas

- Vista de ingresos, egresos, ajustes, citas, temporadas y configuración.
- Valores y tasas históricas almacenados.
- `Snapshot Scope` con periodo, timezone, moneda, modo y filtros.
- conjunto exacto de reglas y versiones;
- versión del motor y del contrato.

### 6.4 Salidas

- `Snapshot Draft`;
- traza de reglas;
- `sourceFingerprint`;
- advertencias de calidad;
- resultado de validación;
- métricas técnicas sin datos sensibles.

### 6.5 Dependencias permitidas

- interfaces de lectura de Dexie;
- lógica financiera existente;
- utilidades actuales de moneda y clasificación;
- reglas vigentes de modos y temporadas;
- Rule Registry;
- canonicalización y hash.

### 6.6 Dependencias prohibidas

- Neon, n8n, Evolution API, WhatsApp, MCP y APIs de modelos;
- estado mutable de UI;
- tasas actuales para recalcular historia;
- código dinámico descargado remotamente.

### 6.7 Lo que nunca hará

Nunca escribirá en Dexie, inventará datos, reclasificará movimientos, ejecutará reglas no registradas, producirá recomendaciones, seleccionará canales ni presentará una estimación como balance canónico.

## 7. Financial Snapshot [FUTURO — NO DESPLEGADO]

Financial Snapshot sustituye el concepto limitado de `Daily Summary`. Es una fotografía derivada, reproducible e inmutable; no es un movimiento ni un cierre contable.

### 7.1 Periodos soportados

- `daily`
- `weekly`
- `monthly`
- `season`
- `trip`
- `year`
- `custom`

`trip` queda reservado hasta que exista una entidad canónica para viaje, fechas y pertenencia de movimientos. No debe inferirse desde ciudad o notas.

### 7.2 Modelo conceptual

Un snapshot contiene:

- `snapshotId`, `snapshotKey`, `revision`, `supersedesSnapshotId`;
- versión de esquema;
- tipo, inicio, fin y timezone del periodo;
- modo de uso, scope y filtros;
- moneda de presentación y contexto autorizado;
- métricas financieras y de calidad;
- versión del motor y del conjunto de reglas;
- reglas y versiones ejecutadas;
- `sourceFingerprint`, `inputHash` y `contentHash`;
- fecha lógica y fecha de generación;
- estado y motivo de revisión.

### 7.3 Identidad y revisión

`snapshotKey` identifica el ámbito lógico mediante sujeto, periodo, timezone, modo, scope y moneda. La revisión no forma parte de esa clave.

Se crea una revisión cuando cambia un dato fuente, regla, contexto o política con impacto material. Una revisión publicada no se sobrescribe; la siguiente la referencia y la anterior queda `superseded`.

### 7.4 Hashes

- `sourceFingerprint`: huella de fuentes relevantes.
- `inputHash`: entradas canonicalizadas, scope y reglas.
- `contentHash`: contenido determinista, excluyendo campos volátiles.

La canonicalización deberá estar versionada.

### 7.5 Estados

```text
draft -> validated -> published -> superseded
                    └────────────> invalidated
draft/validated -> failed
```

Knowledge Layer e Insight Engine solo consumirán snapshots `published`.

## 8. Rule Registry [FUTURO — NO DESPLEGADO]

Rule Registry será el catálogo central de reglas ejecutables por AI Core.

### 8.1 Decisión de diseño

Será inicialmente **code-first y version-controlled**. Las implementaciones financieras no se almacenarán como JavaScript editable en Neon ni como código dinámico en n8n.

### 8.2 Contrato mínimo de regla

- `ruleId`
- `ruleVersion`
- `domain`
- `description`
- `purpose`
- `inputs`
- `outputs`
- `preconditions`
- `applicableScopes`
- `tests`
- `explanationTemplate`
- `status`
- `privacyClassification`
- `introducedAt`
- `deprecatedAt`
- `supersededBy`

### 8.3 Dominios

- Balance.
- Income.
- Expenses.
- Payment Methods.
- Appointments.
- Seasons.
- Currency.
- Statistics.
- Quality.

### 8.4 Estados

- `draft`
- `experimental`
- `active`
- `deprecated`
- `disabled`
- `retired`

Solo reglas `active` producirán artefactos publicados.

### 8.5 Pruebas y explicación

Cada regla deberá incluir pruebas unitarias, límites, ausencia de datos, cero real, datos inválidos, determinismo, compatibilidad por modo y regresión contra la lógica financiera existente.

Cada ejecución explicará regla, objetivo, entradas, exclusiones, operación, resultado, limitaciones y versión sin depender de un LLM.

### 8.6 Evolución

Un cambio material crea una nueva versión. Las versiones usadas por snapshots publicados no se editan retroactivamente. Las reglas deprecadas permanecen disponibles para reproducir historia.

## 9. Knowledge Layer [FUTURO — NO DESPLEGADO]

Knowledge Layer almacenará hechos derivados sobre patrones y características observables.

No almacenará movimientos, balances, eventos, copias completas de snapshots, recomendaciones ni texto generado libremente.

### 9.1 Ejemplos

- método de pago dominante;
- duración habitual;
- promedio histórico por hora;
- categoría de gasto dominante;
- temporada más rentable bajo reglas comparables;
- patrón recurrente de gastos;
- frecuencia de actividad;
- cliente frecuente o inactivo, solo cuando exista identidad canónica o seudonimizada.

El modelo actual no garantiza una entidad cliente. Queda prohibido inferirla desde notas libres.

### 9.2 Unidad de conocimiento

Debe incluir:

- identidad, clave, tipo, sujeto y revisión;
- valor, unidad y dimensiones;
- snapshots fuente;
- regla y versión productora;
- periodo, muestra, cobertura y `evidenceHash`;
- vigencia y política de frescura;
- calidad, limitaciones y explicación;
- referencia a la revisión sustituida.

### 9.3 Persistencia y actualización

La fuente operativa inicial será local. La sincronización con Neon será opcional, minimizada y ligada a un caso de uso aprobado.

El conocimiento podrá actualizarse por un snapshot nuevo o revisado, expiración, cambio de regla o reconstrucción explícita. Debe poder reconstruirse desde snapshots publicados.

### 9.4 Estados y caducidad

- `draft`
- `active`
- `stale`
- `expired`
- `superseded`
- `invalidated`

Una unidad caducada no se borra automáticamente, pero Insight Engine no la tratará como vigente.

### 9.5 Privacidad

- No almacenar notas libres.
- No convertir teléfonos en identidad analítica.
- Seudonimizar sujetos sensibles.
- Evitar granularidad que reconstruya movimientos.
- Aplicar retención y caducidad por tipo.
- No sincronizar conocimiento sensible por defecto.

## 10. Insight Engine [FUTURO — NO DESPLEGADO]

Insight Engine producirá interpretaciones deterministas y explicables sin IA generativa.

### 10.1 Entradas exclusivas

- Financial Snapshots publicados.
- Conocimiento vigente.
- Reglas activas de Rule Registry.

No podrá leer directamente Dexie, movimientos, eventos de automatización, canales, respuestas de Evolution ni salidas de modelos.

### 10.2 Salidas permitidas

- observaciones;
- anomalías;
- comparativas;
- insights deterministas.

No producirá recomendaciones automáticas, órdenes, escrituras financieras ni mensajes enviados directamente.

### 10.3 Contrato conceptual

- identidad, clave y revisión;
- tipo y severidad;
- código de título y parámetros de mensaje;
- referencias a snapshots y conocimiento;
- regla y versión;
- evidencia y explicación;
- clase de confianza;
- vigencia, estado y `contentHash`.

### 10.4 Comparabilidad y anomalías

Solo comparará periodos compatibles según duración, modo, moneda, ubicación, temporada, cobertura, muestra y reglas.

Una anomalía mostrará baseline, ventana, muestra, umbral, valor observado y limitaciones. No equivale automáticamente a error, fraude o problema.

## 11. Notification Center [FUTURO — NO DESPLEGADO]

Notification Center separará la generación de un artefacto de su presentación y entrega.

### 11.1 Canales previstos

- UI interna.
- Notificación local PWA/APK.
- WhatsApp en una fase posterior y con opt-in.
- Canales futuros mediante contratos separados.

### 11.2 Estados

- `draft`
- `pending_approval`
- `approved`
- `ready`
- `processing`
- `sent`
- `failed`
- `suppressed`
- `cancelled`
- `expired`

### 11.3 Reglas

- No habrá envío automático en las primeras fases.
- Las preferencias AI Core serán independientes de las actuales.
- Toda preferencia nueva empezará desactivada.
- La ausencia de canal producirá `suppressed`, nunca fallback global.
- El contenido será minimizado y versionado.
- Notification Center no llamará directamente a Evolution API.

La resolución WhatsApp obligatoria será:

```text
notification
-> deviceCode
-> license_devices
-> user_code
-> communication_channels
-> canal conectado y autorizado
-> n8n
-> Evolution API
```

## 12. Límites entre capas

### 12.1 Dexie

- Fuente canónica financiera.
- Guarda movimientos, agenda, configuración, tasas y temporadas.
- Financial Engine solo lo lee.
- No se replica íntegramente en Neon por defecto.

### 12.2 Automation Gateway

- Autentica licencia y dispositivo.
- Valida JWT, contratos y tamaños.
- Normaliza `eventId` y propaga idempotencia.
- Aplica allowlists y enruta eventos.
- No calcula snapshots, conocimiento o insights.

### 12.3 n8n

- Reclama eventos idempotentemente.
- Orquesta persistencia y entrega.
- Resuelve canales por contexto.
- Aplica plantillas de notificación.
- Llama a Evolution y registra resultados.
- No contiene reglas financieras o estadísticas de negocio.

### 12.4 Neon

- Conserva identidad, autorización, canales e idempotencia actuales.
- Podrá conservar auditoría y réplicas minimizadas de artefactos publicados.
- No sustituye Dexie como libro financiero.

### 12.5 Evolution API

- Entrega WhatsApp autorizada.
- No selecciona destinatarios.
- No interpreta insights.
- No recibe movimientos completos ni secretos ajenos a su operación.

### 12.6 Flujos prohibidos

- Insight Engine -> Dexie financiero.
- Knowledge Layer -> movimientos.
- n8n -> cálculo de balances.
- Neon -> sobrescritura del libro local.
- Evolution -> interpretación financiera.
- LLM -> movimientos.
- MCP -> runtime productivo.

## 13. Qué vive en código y qué vive en n8n

| Responsabilidad | TypeScript/código | n8n |
| --- | --- | --- |
| Lectura de Dexie | Sí | No |
| Reglas financieras | Sí | No |
| Financial Engine | Sí | No |
| Rule Registry e implementaciones | Sí | No |
| Generación y validación de snapshots | Sí | No |
| Derivación de conocimiento | Sí | No |
| Insight Engine determinista | Sí | No |
| Canonicalización y hashes de dominio | Sí | Solo validación de contrato |
| Autenticación y validación del gateway | Sí, servidor | No |
| Reclamación idempotente de efectos | Soporte mediante `eventId` | Sí, respaldada por Neon |
| Persistencia remota de artefactos | Contratos | Sí |
| Resolución segura de canal | Frontera servidor/contexto | Orquestación final |
| Plantillas de entrega | Contrato y versión | Aplicación operacional |
| Llamada a Evolution | No | Sí |
| Reintentos de entrega externa | Outbox hacia gateway | Sí |
| MCP | Auditoría/desarrollo | Nunca runtime |

El código decide el significado financiero. n8n decide cómo transportar, persistir y entregar el resultado.

## 14. Modelo conceptual de persistencia futura [FUTURO]

La persistencia futura separará responsabilidades:

```text
processed_events
    control técnico de idempotencia

automation_event_log
    auditoría append-only de automatizaciones

financial_engine_runs
    trazabilidad técnica de ejecuciones

financial_snapshots
    artefactos financieros derivados y versionados

derived_knowledge
    hechos derivados, vigencia y evidencia

deterministic_insights
    observaciones e insights publicados

notification_outbox
    cola transaccional de efectos externos
```

Estas responsabilidades no deben fusionarse. Ninguna tabla futura convierte a Neon en fuente financiera canónica.

## 15. Tablas propuestas [FUTURAS — NO IMPLEMENTADAS]

> Las tablas de esta sección son propuestas conceptuales. No se han creado ni desplegado.

### 15.1 `automation_event_log`

Sustituye el nombre preliminar `ai_event_store`.

`ai_event_store` es ambiguo y `event_store` podría sugerir que permite reconstruir el libro financiero. El flujo actual no tiene todos los eventos de actualización y eliminación. `automation_event_log` expresa auditoría append-only sin prometer event sourcing.

Campos conceptuales:

- `event_id`, `event_type`, `schema_version`;
- `user_code`, `device_code`, `source`;
- `occurred_at`, `received_at`;
- payload sanitizado y `payload_hash`;
- `correlation_id`, `causation_id`;
- estado y fecha de creación.

### 15.2 `financial_snapshots`

Sustituye `financial_daily_summaries`, cuyo nombre no soporta periodos múltiples.

Contendrá identidad, periodo, revisión, métricas, hashes, versiones, reglas, procedencia, estado y referencia sustituida.

### 15.3 `financial_engine_runs`

Sustituye `analyzer_runs` porque Financial Analyzer deja de ser el concepto vigente. Almacenará telemetría y trazabilidad, nunca copias de movimientos.

### 15.4 `derived_knowledge`

Conservará unidades de conocimiento sincronizadas cuando exista un caso de uso aprobado: identidad, tipo, sujeto seudonimizado, valor, evidencia, regla, vigencia, calidad, explicación, hashes y estado.

### 15.5 `deterministic_insights`

Conservará insights publicados y sus revisiones. Se evita `ai_insights` mientras su naturaleza sea determinista.

### 15.6 `notification_outbox`

Se mantiene como nombre objetivo. Será una cola de efectos externos con `dedupe_key` único, estados, aprobación, intentos y resultado.

### 15.7 `processed_events` [RESPALDO VERSIONADO ACTUAL]

Mantiene exclusivamente la idempotencia técnica. No es Event Store, Knowledge Layer, repositorio de snapshots, repositorio de insights ni notification outbox.

## 16. Eventos propuestos [FUTUROS — NO IMPLEMENTADOS]

> Estos eventos todavía no forman parte del contrato operativo y no deben enviarse hasta completar su fase.

| Evento futuro | Productor previsto | Finalidad |
| --- | --- | --- |
| `financial.snapshot.generated` | Financial Snapshot | Publicar un snapshot validado y minimizado |
| `financial.snapshot.revised` | Financial Snapshot | Publicar una nueva revisión |
| `knowledge.derived` | Knowledge Layer | Registrar conocimiento derivado autorizado |
| `knowledge.expired` | Knowledge Layer | Marcar pérdida de vigencia |
| `insight.generated` | Insight Engine | Publicar un insight determinista |
| `insight.expired` | Insight Engine | Marcar caducidad |
| `notification.draft.created` | Notification Center | Crear borrador sin envío |
| `notification.delivery.requested` | Acción aprobada | Solicitar entrega externa |
| `notification.delivery.completed` | n8n | Registrar entrega completada |
| `notification.delivery.failed` | n8n | Registrar fallo normalizado |

Eventos como `income.updated`, `expense.updated` o eliminaciones requerirán una iniciativa separada. No deben añadirse superficialmente para simular event sourcing.

## 17. Workflows propuestos [FUTUROS — NO IMPLEMENTADOS]

> Los siguientes workflows son arquitectura objetivo. No existen ni están desplegados por efecto de este documento.

### 17.1 AI Core Event Ingestion

- autenticar y validar;
- reclamar `eventId` atómicamente;
- verificar `payload_hash`;
- sanitizar mediante allowlist;
- persistir en `automation_event_log`;
- responder JSON en todas las ramas.

No calculará finanzas ni enviará WhatsApp.

### 17.2 Financial Snapshot Persistence

- recibir snapshots generados o revisados;
- validar versión, periodo, timezone, moneda y hashes;
- aplicar idempotencia;
- persistir revisiones append-only;
- responder JSON.

No reconstruirá el snapshot desde eventos.

### 17.3 Knowledge and Insight Persistence

- validar artefactos publicados;
- verificar referencias, reglas y vigencia;
- persistir versiones y revisiones;
- no generar conocimiento o insights dentro de n8n.

### 17.4 Notification Dispatcher

- seleccionar una notificación `ready`;
- reclamarla atómicamente;
- resolver el canal contextual;
- comprobar preferencias y estado;
- componer plantilla versionada;
- llamar a Evolution;
- registrar resultado;
- responder JSON siempre.

Permanecerá sin envíos automáticos durante el piloto.

### 17.5 AI Core Operations Audit

- detectar eventos atascados;
- detectar snapshots retrasados o inválidos;
- detectar artefactos caducados;
- detectar notificaciones duplicadas o bloqueadas;
- emitir alertas operativas internas, nunca recomendaciones financieras.

## 18. Idempotencia futura

- Eventos: `eventId` único y `payload_hash` verificado.
- Snapshots: `snapshotKey + revision + contentHash`.
- Conocimiento: `knowledgeType + subject + dimensions + derivation policy`.
- Insights: `insightType + subject + scope + ruleVersion + evidenceHash`.
- Notificaciones: `notificationType + sourceArtifactId + recipientContext + provider + templateVersion`.

La transición `ready -> processing` de notificaciones deberá ser condicional y atómica. Un reintento no podrá duplicar un mensaje ya enviado.

## 19. Roadmap por fases [PENDIENTE DE IMPLEMENTACIÓN]

### Fase 0 — Arquitectura y contratos

- Aprobar arquitectura y ADRs.
- Definir contratos, privacidad, timezone, periodos, hashes y comparabilidad.
- Inventariar reglas financieras existentes.

### Fase 1 — Financial Engine [PARCIALMENTE IMPLEMENTADA]

- [IMPLEMENTADO] Adaptador de solo lectura que reutiliza lógica existente.
- [IMPLEMENTADO] Ejecución determinista y pruebas de paridad.
- [IMPLEMENTADO] Reports en shadow mode y piloto acotado de Home bajo feature flag de build.
- [PENDIENTE] Promoción global, contratos completos y cualquier consumidor adicional; no forman parte del milestone actual.

### Fase 2 — Financial Snapshot

- Modelo común de periodos.
- Revisiones y hashes.
- Publicación local.
- `trip` permanece reservado.

### Fase 3 — Rule Registry

- Catálogo completo.
- IDs, versiones, estados, pruebas y explicaciones.
- Deprecación y compatibilidad.

El contrato mínimo de regla se utiliza desde Fase 1; esta fase formaliza el registro completo después de comprobar reglas reales.

### Fase 4 — Knowledge Layer

- Conocimiento local desde snapshots publicados.
- Vigencia, caducidad, evidencia y privacidad.
- Sujetos personales aplazados hasta identidad canónica.

### Fase 5 — Notification Center

- Bandeja interna, estados, aprobación y deduplicación.
- Notificación local opcional.
- Sin WhatsApp automático.

### Fase 6 — Insight Engine

- Observaciones, comparativas, anomalías e insights deterministas.
- Explicaciones y expiración.
- Integración con Notification Center.

### Fase 6B — WhatsApp controlado

Requiere workflows legacy saneados, resolución contextual verificada, opt-in, auditoría multiusuario, deduplicación y aprobación manual.

### Fase 7 — LLM opcional

Requiere decisión independiente, política de privacidad, entrada estructurada, evaluación, registro de modelo y prohibición técnica de escritura.

Este orden reduce riesgo porque estabiliza primero los cálculos y artefactos, deriva después el conocimiento, construye una salida segura y deja canales externos y LLM para el final.

## 20. Riesgos y mitigaciones

### 20.1 Técnicos

- **Divergencia de cálculos:** paridad, reutilización y prohibición de cálculo en n8n.
- **Hashes no deterministas:** canonicalización versionada y pruebas.
- **Lecturas inconsistentes:** vistas coherentes y fingerprints.
- **Crecimiento append-only:** retención, referencias y no duplicación de payloads.
- **Dependencias circulares:** flujo unidireccional y contratos.

### 20.2 Funcionales

- **Confundir snapshot con cierre:** declarar que no bloquea ni modifica movimientos.
- **Comparaciones inválidas:** reglas explícitas de compatibilidad.
- **Confundir falta de datos con cero:** estados diferenciados.
- **Activar `trip` sin entidad:** mantenerlo reservado.
- **Inferir clientes desde notas:** prohibición e identidad futura seudonimizada.

### 20.3 Privacidad

- **Sincronización excesiva:** local-first, allowlists y minimización.
- **Conocimiento conductual sensible:** caducidad, seudonimización y consentimiento.
- **Reconstrucción desde agregados:** limitar granularidad.
- **Entrega al canal incorrecto:** resolución contextual obligatoria.
- **Retención indefinida:** políticas por artefacto.

### 20.4 Escalabilidad

- **Exceso de snapshots/revisiones:** fingerprints y retención.
- **Recomputación completa:** actualización incremental reproducible.
- **Scopes custom ilimitados:** límites y cuotas.
- **Consultas remotas costosas:** índices por sujeto, periodo, tipo y estado.

### 20.5 Duplicación de lógica

- **Copia de helpers o fórmulas:** un único propietario por cálculo.
- **Cálculo directo desde Knowledge o Insights:** acceso exclusivo mediante snapshots.
- **Lógica financiera en workflows:** revisión y pruebas de contratos.

### 20.6 IA futura

- **Alucinación o evidencia inventada:** entradas estructuradas y validación.
- **Recomendaciones no solicitadas:** aprobación humana y alcance limitado.
- **Exposición de datos:** minimización y política de proveedor.
- **Prompt injection:** exclusión de notas libres y contenido no confiable.
- **Automatización de decisiones:** prohibición técnica de escritura.

## 21. Criterios de aceptación arquitectónicos

- Financial Engine tiene un límite verificable de solo lectura.
- Existe paridad con los cálculos financieros actuales.
- Ninguna regla financiera se duplica en n8n.
- Financial Snapshot usa un modelo único para todos los periodos.
- `trip` permanece inactivo sin entidad canónica.
- Revisiones publicadas son append-only.
- Canonicalización y hashes están versionados.
- Rule Registry es code-first y enlaza pruebas.
- Knowledge Layer no almacena movimientos, balances o eventos.
- Insight Engine no accede directamente a Dexie.
- Insight Engine no produce recomendaciones automáticas.
- Notification Center separa generación, aprobación y entrega.
- WhatsApp se resuelve exclusivamente por contexto.
- `processed_events` permanece separado de artefactos de dominio.
- Neon no se convierte en libro financiero canónico.
- MCP no se convierte en runtime.
- Cada fase distingue claramente diseño, implementación y despliegue real.

## 22. Decisiones aprobadas y pendientes

### 22.1 Decisiones aprobadas por esta arquitectura

- Separación en Financial Engine, Financial Snapshot, Rule Registry, Knowledge Layer e Insight Engine.
- Financial Snapshot sustituye `Daily Summary` como concepto general.
- Financial Engine es determinista y de solo lectura.
- Rule Registry será inicialmente code-first.
- Knowledge Layer deriva conocimiento desde snapshots, no desde movimientos directos.
- Insight Engine consume exclusivamente snapshots, conocimiento y reglas.
- Notification Center separa generación y entrega.
- `automation_event_log` es preferible a `ai_event_store`.
- `financial_snapshots` sustituye `financial_daily_summaries`.
- `financial_engine_runs` sustituye `analyzer_runs`.
- `notification_outbox` conserva su nombre y responsabilidad.
- La IA generativa queda fuera de las primeras fases.

Estas decisiones describen la arquitectura objetivo. Cuando corresponda, deberán reflejarse en ADRs antes de implementación.

### 22.2 Pendiente de decisión

- Formato exacto de canonicalización y hash.
- Semántica inclusiva o exclusiva de `periodEnd`.
- Política final de semana y timezone.
- Persistencia local concreta de snapshots y conocimiento.
- Retención local y remota.
- Identidad global de artefactos.
- Alcance de sincronización con Neon.
- Reconstrucción tras cambio de regla.
- Entidades canónicas de `trip` y `client`.
- Catálogo inicial de reglas activas.
- Límites de scopes `custom`.
- Preferencias específicas de Notification Center.

## 23. Relación con la documentación existente

### `PRIVATE_BALANCE_CONSTITUTION.md`

Mantiene autoridad superior. Este documento desarrolla sus principios de local-first, reproducibilidad, seguridad, idempotencia, separación de responsabilidades y prohibición de escritura financiera por IA. Si existe contradicción, prevalece la Constitución.

### `01_ARCHITECTURE.md`

Continúa describiendo la arquitectura general implementada. Este documento amplía exclusivamente la arquitectura objetivo del AI Core y no reemplaza la visión global.

### `03_DATABASE.md`

Continúa documentando la persistencia realmente existente. Las tablas propuestas aquí no deben aparecer allí como implementadas hasta ser creadas, desplegadas y verificadas.

### `04_N8N_WORKFLOWS.md`

Continúa siendo el inventario de workflows reales. Los workflows futuros de este documento solo deberán añadirse a ese inventario después de su despliegue y validación.

### `AUTOMATION_HUB.md`

Continúa siendo la referencia operativa del transporte seguro, JWT, gateway, outbox, eventos e idempotencia. AI Core deberá integrarse mediante esa frontera, no crear un canal paralelo.

### `07_AI_ROADMAP.md`

Mantiene la visión general de oportunidades. Este documento define la arquitectura detallada y las fases del AI Core; una futura actualización documental podrá enlazarlo sin duplicar contratos.

### `DECISIONS.md`

Las decisiones vinculantes que requieran formalización deberán incorporarse como ADRs antes de implementar. Este documento no reemplaza el registro de decisiones.

## 24. Regla de verdad documental

Este documento describe principalmente el **objetivo aprobado**; la sección 3.1 identifica de forma expresa el piloto realmente implementado. `01_ARCHITECTURE.md`, `03_DATABASE.md`, `04_N8N_WORKFLOWS.md` y `AUTOMATION_HUB.md` describen la **realidad implementada y operativa**.

Una tabla, evento, workflow o componente futuro no podrá tratarse como desplegado únicamente porque aparezca aquí. Su estado solo cambia después de implementación, despliegue, verificación y actualización explícita de la documentación operativa correspondiente.

## 25. Decisión arquitectónica final

La arquitectura objetivo del AI Core queda organizada así:

```text
Financial Engine
    produce cálculos deterministas

Financial Snapshot
    publica estados derivados versionados

Rule Registry
    gobierna reglas, versiones, pruebas y explicación

Knowledge Layer
    conserva hechos derivados con vigencia

Insight Engine
    produce interpretaciones deterministas
```

Notification Center, Automation Gateway, n8n, Neon y Evolution forman la ruta de presentación, sincronización y entrega. No forman parte del cálculo financiero.

La implementación deberá comenzar por contratos y paridad financiera. La IA generativa queda expresamente fuera del núcleo y fuera de las primeras fases.

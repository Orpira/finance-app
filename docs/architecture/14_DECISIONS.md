# 14 - Decisions (Operational Consolidation)

## 1) Decisiones aceptadas vigentes

### D-001 Neon como base principal de backend

- Estado: aceptada.
- Resultado: licencias/dispositivos/canales se resuelven sobre Neon.

### D-002 n8n como motor de automatización

- Estado: aceptada.
- Resultado: workflows orquestan eventos y delivery externo.

### D-003 Evolution API encapsulada

- Estado: aceptada.
- Resultado: WhatsApp no se consume directo desde cliente.

### D-004 MCP/IA como herramienta de desarrollo, no runtime

- Estado: aceptada.
- Resultado: no dependencia operacional productiva de agentes.

### D-005 Resolución contextual obligatoria de canal

- Estado: aceptada.
- Resultado: `deviceCode -> userCode -> communication_channels`.

### D-006 Constitución técnica como fuente canónica

- Estado: aceptada.
- Resultado: jerarquía documental explícita.

## 2) Decisiones de implementación AI Foundation

### D-007 Legacy continúa oficial por defecto

- Estado: aceptada para fase actual.
- Resultado: adapters/pipelines no sustituyen globalmente la fuente financiera.

### D-008 Feature flags exactos para pilotos

- Estado: aceptada.
- Resultado: rollback por rebuild/redeploy sin mutación de datos históricos.

### D-009 Snapshots/Knowledge append-only

- Estado: aceptada.
- Resultado: trazabilidad por revisiones y prohibición de sobrescritura.

### D-010 Dashboard Insights desacoplado

- Estado: aceptada.
- Resultado: UI consume 7D/7E sin acoplar runtime interno.

## 2.1) Decisiones PB-IS-0007 (Método de cálculo del ingreso + Adicionales)

### D-011 "Jornada por horas" nunca aplica el % de temporada

- Estado: aceptada (confirmada explícitamente con el propietario del proyecto ante ambigüedad de la especificación original).
- Resultado: `realGain = workedHours × hourlyRate` para este método, sin recorte por `EarningPeriod.percentage`. El pago por hora ya es el 100% del ingreso final de la profesional, a diferencia de "Servicio por tiempo" (reparto vía `calculateStoredRealGain`).

### D-012 Los Adicionales nunca se suman al registro del ingreso

- Estado: aceptada. **Supersede** una decisión anterior de esta misma sesión (`additionalsTotal` sumado a `realGain` del ingreso), revertida tras probar la funcionalidad en el navegador: mezclar Adicionales dentro de `realGain` generaba un total confuso en el listado de ingresos ("no debés sumar al total calculado los adicionales, ese total es solo de horas trabajadas").
- Resultado: `ServiceIncome.realGain`/`totalAmount`/`eurValue`/`copValue`/etc. reflejan ÚNICAMENTE el trabajo realizado (servicio o jornada), calculados una sola vez al crear/editar el ingreso, y **nunca se recalculan** por agregar o quitar un Adicional — ni siquiera al crear el ingreso con adicionales ya cargados en el borrador. Solo `additionalsTotal` (campo propio) se mantiene al día. Según ADR-035 (sustituye la definición de Ingresos de ADR-033), `getStoredIncomePrincipalValue` es la lectura de Ingresos y de Ganancia; `getStoredIncomeValue` (con Adicionales) es la lectura de "Total recibido" y, combinada con egresos e impacto de ajustes en `buildBalanceReport`, de "Balance general neto" (nombre propio, no la misma etiqueta). `totalIncome` es legado no autoritativo.

### D-013 `totalAmount` reutilizado como "ingreso principal" en vez de una columna nueva

- Estado: aceptada.
- Resultado: en lugar de agregar un campo `ingreso_principal` duplicado (como sugería literalmente la especificación), `ServiceIncome.totalAmount` extiende su significado ya establecido a "Jornada por horas" (`workedHours × hourlyRateApplied`). No es un rename: el campo conserva su nombre y su rol de "importe principal del ingreso" en ambos métodos.

### D-014 Adicionales se eliminan en cascada con el ingreso, a diferencia de los Ajustes

- Estado: aceptada.
- Resultado: `incomeAdditionals` no bloquea el borrado del ingreso padre (`deleteServiceIncome` los borra en la misma transacción), porque un Adicional no es un movimiento financiero independiente — a diferencia de los ajustes en `expenses`, que sí bloquean el borrado mientras existan.

### D-015 El método de cálculo es seleccionable por ingreso al crear, no solo por ajuste global

- Estado: aceptada (solicitada explícitamente por el propietario del proyecto: necesitaba registrar, caso por caso, un servicio por horas que sí aplicara el % de temporada, cosa que "Jornada por horas" nunca hace por D-011).
- Resultado: `IncomePage.tsx` incorpora un selector de método ("Servicio por tiempo" / "Jornada por horas") visible únicamente al crear un ingreso profesional de tipo servicio, que parte del valor del ajuste global de Configuración (`settings.incomeCalculationMethod`) como default pero puede sobreescribirse para ese ingreso puntual. El ajuste global de Configuración no cambia y sigue siendo el valor por defecto para nuevos ingresos.
- No reabre D-011: "Jornada por horas" sigue sin aplicar nunca el % de temporada; lo que cambia es que ahora se puede *elegir* ese método (o el otro) por ingreso, en vez de quedar fijado únicamente por el ajuste global.
- Respeta la inmutabilidad ya existente (PB-IS-0007, sección 9): el selector no aparece al editar un ingreso ya creado; `incomeService.ts` sigue descartando `incomeCalculationMethod` en cualquier actualización.

### D-016 "Jornada por horas" permite aplicar el % de temporada como opt-in explícito por ingreso

- Estado: aceptada (solicitada explícitamente por el propietario del proyecto, revisando D-011 tras D-015: el selector de método por sí solo no bastaba, porque "Servicio por tiempo" usa un flujo distinto — duración en minutos vía `ServiceDurationSelect` + importe tecleado — y no permite registrar horas trabajadas × valor por hora aplicando el %).
- Resultado: `hourlyWorkdayCalculator.ts` acepta `applySeasonPercentage?: boolean` en `IncomeCalculationInput`. Por defecto (`false`/`undefined`) el comportamiento de D-011 se preserva sin cambios: `realGain = workedHours × hourlyRate`, 100% para la profesional. Si se activa explícitamente, `realGain = workedHours × hourlyRate × (percentage / 100)`, usando el mismo % que usaría "Servicio por tiempo" (el % activo de la temporada). `IncomePage.tsx` agrega el interruptor "¿Aplicar el % de temporada a este ingreso?" (No/Sí) dentro del formulario de Jornada por horas, visible tanto al crear como al editar (a diferencia del selector de método de D-015, este campo no es inmutable — `percentage`/`realGain` ya eran editables antes de esta decisión).
- Persistencia: `ServiceIncome.hourlyAppliesSeasonPercentage?: boolean` (nuevo campo opcional, sin migración Dexie — no indexado) registra la elección de forma explícita y auditable, sin inferirla del campo `percentage` (que `createServiceIncome` puede sobreescribir con el % de la temporada activa para cualquier ingreso de tipo servicio, independientemente del método — comportamiento preexistente no modificado por esta decisión).
- Fail-closed (principio no negociable de `AGENTS.md`): si `applySeasonPercentage` es `true` sin un `percentage` válido (> 0), tanto `IncomePage.tsx` como `assertIncomeCalculationInputIsValid` rechazan el guardado/cálculo en vez de asumir un 100% o un 0% silencioso.
- No reabre D-011 como regla por defecto: "Jornada por horas" sigue siendo 100% para la profesional salvo que la usuaria decida explícitamente lo contrario, ingreso por ingreso.

## 3) Decisiones pendientes (requieren ADR futura)

1. Definición normativa oficial del milestone 8A con criterios medibles.
2. Política de retención/archivado de snapshots y knowledge.
3. Estrategia formal de convergencia total de workflows legacy.
4. Nivel de adopción global futura de Financial Engine como fuente oficial.

## 4) Criterio para introducir nuevas decisiones

- debe existir problema técnico explícito;
- debe evaluarse impacto en invariantes financieros/seguridad;
- debe incluir plan de rollback;
- debe registrar consecuencias operativas y de testing.

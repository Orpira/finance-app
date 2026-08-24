# 12 - Testing

## 1) Estrategia de pruebas

Se prioriza cobertura de:

- lógica de dominio determinista;
- fronteras de integración (gateway/webhook);
- persistencia append-only e idempotencia;
- flujos críticos de AI Foundation e Insights.

Los incrementos funcionales siguen TDD (`RED -> GREEN -> REFACTOR`) según la
disciplina operativa descrita en [../TESTING.md](../TESTING.md).

## 2) Herramientas

- `vitest` para unitarias/integración de módulos TS.
- runner browser para `test:indexeddb` en persistencia real.
- ESLint como barrera estática de calidad.

## 3) Comandos operativos

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run test:indexeddb`
- `npm run lint`

## 4) Última validación completa

Validación de PB-001 a PB-003 y de la corrección posterior del método/tarifa,
ejecutada el 2026-08-05:

- 183 archivos de prueba aprobados;
- 2118 pruebas aprobadas;
- 1 `todo` preexistente;
- ESLint y build TypeScript/Vite correctos;
- migración Dexie v31 aprobada en el runner de IndexedDB real.

Estas cifras describen una ejecución concreta; no representan porcentaje de
cobertura lineal.

## 5) Suites relevantes detectadas

### Núcleo financiero

- `balanceReportService.test.ts`
- `financialEngineAdapter.test.ts`
- `financialEngineShadowMode.test.ts`
- `homeBalanceSummaryService.test.ts`
- `financeStats.test.ts`

### Onboarding y planificación de temporada (PB-001 a PB-003)

- `onboarding.test.ts` — estado versionado, decisión de navegación, método de
cálculo, tarifa obligatoria y "No aplica = 100 %".
- `onboardingIncomeMethodStep.test.tsx` — contrato visible del paso profesional:
métodos canónicos sin confundirlos con unidades de duración.
- `seasonPlanning.test.ts` — progreso, meta alcanzada, sobrecumplimiento y
restante nunca negativo.
- `serviceDuration.test.ts` y `serviceDurationSelect.test.tsx` — regresión de
presentación y almacenamiento de la duración.
- `test/indexeddb/browser.ts` — migración v31 sobre IndexedDB real, preservando
movimientos y saneando solo planificación opcional inválida.

### Método de cálculo del ingreso y Adicionales (PB-IS-0007)

- `incomeCalculationMethods.test.ts` — catálogo de métodos/unidades.
- `incomeSettingsDefaults.test.ts` — defaults de `AppSettings` (`createDefaultSettings`).
- `incomeCalculation.test.ts` — motor Strategy: equivalencia byte-a-byte con `calculateStoredRealGain` para "Servicio por tiempo", cálculo sin % para "Jornada por horas", validaciones, despachador.
- `incomeAdditionals.test.ts` — validación/suma pura de la entidad Adicional.
- `incomeService.test.ts` — defaults de método, inmutabilidad al editar, cascade-delete de Adicionales (gap detectado: este archivo no tenía tests previos a este milestone).
- `incomeAdditionalService.test.ts` — CRUD y consistencia de Adicionales según
la regla que mantiene el importe principal separado.
- `incomeDetailAdditionals.test.tsx` — presentación de importe y descripción de
  cada Adicional en el detalle del ingreso, incluido el ocultamiento de valores
  sensibles.
- `serviceTimerService.test.ts` — regresión: "Jornada por horas" nunca inicia el cronómetro (test sobre el guard ya existente, sin cambio de producción).
- `appointmentService.test.ts` — disponibilidad de intervalos, creación
  concurrente, inicio temporal e idempotencia de inicio y reclamación de cierre;
  la concurrencia se modela con una cola serializada en el mock de
  `db.transaction`.
- `appointmentCompletionService.test.ts` — las citas agendadas siempre
  persisten `service_duration`, no crean ingreso sin servicio activo y limitan
  cinco finalizaciones concurrentes a una invocación de `createServiceIncome`.
- `appointmentReminders.test.ts` — alarma inicial de 5 minutos y cálculo siempre
  anterior al inicio para las dos alarmas configurables.
- `backupService.test.ts` — `incomeAdditionals` viaja en la cadena de backup.

### Snapshot / Knowledge

- `snapshot*` tests (builder, validator, canonicalizer, fingerprint, sealer, shadow, promotion)
- `knowledge*` tests (builder, validator, canonicalizer, fingerprint, sealer, repository, shadow, promotion)

### Insight Engine

- `insightRule`, `insightBuilder`, `insightValidator`, `insightRepository`, `insightEngine`, `insightRuntime`
- `insightExecutionService`, `insightReadModels`, `insightDashboardIntegration`

### Automatización / backend

- `automationGateway.test.ts`
- `automationHandler.test.ts`
- `licenseRegistry.test.ts`
- `webhookDispatcher.test.ts`
- `licenseCommunicationSeparation.test.ts`

### Persistencia real

- `test/indexeddb/*` con navegador real.

## 6) Principios de diseño de prueba observados

- determinismo sin IO para dominio puro;
- fail-closed en validaciones;
- escenarios de fallback explícitos;
- verificación de inmutabilidad/append-only.

## 7) Gaps actuales

- falta de cobertura e2e completa de workflows n8n fuera del entorno de tests unitarios;
- falta validar en navegador/IndexedDB real la doble pulsación sobre inicio y
  finalización de citas; las pruebas actuales de concurrencia usan un mock
  serializado de transacciones;
- falta cubrir la recuperación cuando la cita ya fue reclamada como completada
  y la creación posterior del ingreso falla;
- branch protection de GitHub pendiente de configuración para hacer obligatorio
el CI ya existente.

## 8) Recomendaciones

1. formalizar matriz de smoke tests de release.
2. añadir pruebas contractuales de ramas n8n críticas.
3. introducir reporte de cobertura consolidado por módulo.
4. separar suites rápidas y suites pesadas para feedback incremental.

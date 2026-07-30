# 12 - Testing

## 1) Estrategia de pruebas

Se prioriza cobertura de:

- lógica de dominio determinista;
- fronteras de integración (gateway/webhook);
- persistencia append-only e idempotencia;
- flujos críticos de AI Foundation e Insights.

## 2) Herramientas

- `vitest` para unitarias/integración de módulos TS.
- runner browser para `test:indexeddb` en persistencia real.
- ESLint como barrera estática de calidad.

## 3) Comandos operativos

- `npm test`
- `npm run build`
- `npm run test:indexeddb`
- `npm run lint`

## 4) Cobertura observable por inventario

Conteo por patrón ejecutado sobre `src`, `test`, `api`, `server`:

- `describe_total=56`
- `test_total=866`

Nota: estas cifras son métricas de inventario textual, no porcentaje de cobertura lineal.

## 5) Suites relevantes detectadas

### Núcleo financiero

- `balanceReportService.test.ts`
- `financialEngineAdapter.test.ts`
- `financialEngineShadowMode.test.ts`
- `homeBalanceSummaryService.test.ts`
- `financeStats.test.ts`

### Método de cálculo del ingreso y Adicionales (PB-IS-0007)

- `incomeCalculationMethods.test.ts` — catálogo de métodos/unidades.
- `incomeSettingsDefaults.test.ts` — defaults de `AppSettings` (`createDefaultSettings`).
- `incomeCalculation.test.ts` — motor Strategy: equivalencia byte-a-byte con `calculateStoredRealGain` para "Servicio por tiempo", cálculo sin % para "Jornada por horas", validaciones, despachador.
- `incomeAdditionals.test.ts` — validación/suma pura de la entidad Adicional.
- `incomeService.test.ts` — defaults de método, inmutabilidad al editar, cascade-delete de Adicionales (gap detectado: este archivo no tenía tests previos a este milestone).
- `incomeAdditionalService.test.ts` — CRUD de Adicionales, recálculo de `realGain`/`totalIncome`/valores convertidos por método.
- `serviceTimerService.test.ts` — regresión: "Jornada por horas" nunca inicia el cronómetro (test sobre el guard ya existente, sin cambio de producción).
- `appointmentCompletionService.test.ts` — las citas agendadas siempre persisten `service_duration`, sin leer la configuración del método.
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
- ausencia de pipeline CI/CD formal documentado para gates automáticos;
- deuda de lint global fuera de algunos alcances funcionales.

## 8) Recomendaciones

1. formalizar matriz de smoke tests de release.
2. añadir pruebas contractuales de ramas n8n críticas.
3. introducir reporte de cobertura consolidado por módulo.
4. separar suites rápidas y suites pesadas para feedback incremental.

# 05 - Services

## 1) Rol de `src/services`

`src/services` concentra la capa de aplicación: orquesta reglas, llamadas de persistencia, integración externa y contratos de frontera consumidos por UI.

## 2) Catálogo por dominio

### Finanzas y reportes

- `incomeService.ts`
- `expenseService.ts`
- `balanceReportService.ts`
- `cutoffReportService.ts`
- `reportShareService.ts`
- `currencyConversionService.ts`
- `exchangeRateService.ts`

Responsabilidad: CRUD financiero, conversiones, balance y exportables.

### Agenda y temporadas

- `appointmentService.ts`
- `appointmentCompletionService.ts`
- `earningPeriodService.ts`
- `serviceTimerService.ts`
- `serviceTimerNotificationService.ts`
- `reminderService.ts`

Responsabilidad: ciclo de citas/temporizadores y contexto profesional.

### Configuración y seguridad local

- `settingsService.ts`
- `pinService.ts`
- `securityRecoveryService.ts`
- `signedLicenseService.ts`
- `licenseService.ts`
- `licenseAuthorizationService.ts`
- `licenseDeviceService.ts`
- `deviceIdentityService.ts`
- `playIntegrityService.ts`

Responsabilidad: settings, PIN, licencias y estado de dispositivo.

### Backup y operación

- `backupService.ts`
- `googleDriveBackupService.ts`
- `encryptionService.ts`

Responsabilidad: respaldo, cifrado y automatización de tareas de backup.

### Automatización e integración remota

- `automationOutboxService.ts`
- `automationHubService.ts`
- `communicationChannelService.ts`

Responsabilidad: outbox, token/JWT, dispatch y estado de canal.

### AI Foundation / Insights

- `financialEngineAdapter.ts`
- `financialEngineShadowMode.ts`
- `financialEnginePromotionPolicy.ts`
- `homeBalanceSummaryService.ts`
- `snapshotShadowModeService.ts`
- `snapshotPromotionExecutor.ts`
- `snapshotKnowledgeIntegration.ts`
- `knowledgeShadowModeService.ts`
- `knowledgePromotionExecutor.ts`
- `knowledgeIntegration.ts`
- `runtimeAdapter.ts`
- `insightExecutionService.ts`
- `insightReadModels.ts`

Responsabilidad: pipeline determinista, validación de fronteras y proyección para UI.

## 3) Convenciones de servicio observadas

- contratos explícitos de entrada/salida con tipos;
- validaciones fail-closed;
- fallback seguro al comportamiento legacy cuando aplica;
- separación entre ejecución oficial y shadow/observación;
- no side-effects financieros en servicios de proyección.

## 4) Servicios críticos para operación diaria

- `settingsService`: estado transversal de modo, moneda, tema y reglas.
- `automationOutboxService`: resiliencia ante fallas de red.
- `homeBalanceSummaryService`: integración legacy + adapter + snapshot.
- `communicationChannelService`: UX de estado WhatsApp en cliente.

## 5) Servicios críticos para certificación técnica

- `snapshotShadowModeService`: append-only + deduplicación + material diff audit.
- `knowledgeShadowModeService`: pipeline derivado con control de versiones.
- `insightExecutionService` y `insightReadModels`: frontera contractual 7D/7E.

## 6) Antipatrones a evitar en esta capa

- mezclar UI rendering con orquestación de servicios;
- acceso directo de páginas a repositorios internos;
- usar servicios de shadow como fuente oficial global;
- incorporar secretos o tokens persistentes en almacenamiento local.

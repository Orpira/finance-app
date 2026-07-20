# 02 - Folder Structure

## 1) Raíz del repositorio

- `src/`: aplicación cliente (UI, servicios, tipos, utilidades, inteligencia).
- `api/`: endpoints Vercel Functions.
- `server/`: utilidades de backend, seguridad, SQL runtime y migraciones.
- `docs/`: documentación canónica y operativa.
- `test/`: pruebas unitarias/integración y validación IndexedDB en navegador.
- `scripts/`: utilidades de build, deploy y operaciones de soporte.
- `android/`: proyecto nativo Capacitor/Gradle.

## 2) Estructura de `src/` por responsabilidad

- `src/app/`: layout global y shell de ejecución.
- `src/routes/`: enrutado principal y guardias.
- `src/pages/`: pantallas por módulo funcional.
- `src/components/`: piezas de UI reutilizables.
- `src/services/`: servicios de aplicación, adaptadores y fronteras.
- `src/database/`: configuración Dexie, migraciones y snapshot import/export.
- `src/types/`: contratos de dominio y DTOs.
- `src/utils/`: utilidades puras de cálculo/formateo/reglas auxiliares.
- `src/intelligence/`: subsistemas financial-snapshot y knowledge-layer.
- `src/insight/`: modelo de reglas, builder, validator, runtime y repositorio de insights.

## 3) Estructura de `server/`

- `server/apiUtils.ts`: hardening HTTP, CORS, content-type, límites de tamaño.
- `server/automationSecurity.ts`: firma de licencia, emisión/verificación JWT.
- `server/licenseDeviceRegistry.ts`: esquema + autorización de dispositivos en Neon.
- `server/automation/*`: dispatcher y resolución contextual de comunicación.
- `server/migrations/*`: SQL de evolución para licencias/canales/dispositivos.

## 4) Estructura de `api/`

- `api/automation-token.ts`: emite JWT temporal tras validar licencia.
- `api/automation.ts`: gateway de eventos a n8n.
- `api/communication-channel.ts`: consulta de canal activo por usuario/dispositivo.
- `api/license-activate.ts`: activación/registro de dispositivo por licencia.

## 5) Estructura de `test/`

- Tests por dominio en raíz (`*.test.ts`).
- `test/indexeddb/`: ejecución browser-real para validaciones de persistencia.
- Cobertura sobre adapter financiero, snapshots, knowledge, insights, gateway y webhook dispatcher.

## 6) Convención de límites entre carpetas

- `pages` consume `services`; no debe acoplarse a persistencia interna.
- `services` consume `types`, `utils`, `database`, `intelligence`/`insight` según frontera.
- `api` consume `server`; no debe replicar lógica de infraestructura ya centralizada.
- `docs` debe reflejar código implementado y ADRs, no hipótesis.

## 7) Hotspots actuales

- `src/database/db.ts`: evolución histórica de migraciones Dexie.
- `src/services/*shadow*` y `*promotion*`: control de feature flags y fallback.
- `server/licenseDeviceRegistry.ts`: lógica SQL crítica de autorización.
- `server/automation/*`: punto de fallo sensible para eventos y canales.

## 8) Regla práctica de navegación para nuevos agentes

1. Leer `docs/PRIVATE_BALANCE_CONSTITUTION.md`.
2. Revisar `src/routes/index.tsx` y `src/app/AppLayout.tsx`.
3. Revisar `src/database/db.ts`.
4. Revisar `src/services/` por módulo objetivo.
5. Revisar `api/` y `server/` si hay impacto de integración remota.

# AGENTS.md — Guía para agentes de IA y nuevos colaboradores

Esta guía es un punto de entrada práctico para cualquier agente de IA (Claude, Codex, ChatGPT, MCP u otro) o persona nueva que vaya a trabajar en Private Balance. No sustituye la documentación canónica; la resume y apunta a ella.

**Antes de proponer cualquier cambio, lee primero:**

1. [docs/PRIVATE_BALANCE_CONSTITUTION.md](docs/PRIVATE_BALANCE_CONSTITUTION.md) — reglas de negocio y principios técnicos. Es la fuente principal de verdad; si algo aquí contradice la Constitución, prevalece la Constitución.
2. [docs/MCP_RULES.md](docs/MCP_RULES.md) — resumen operativo aún más breve, pensado para auditoría automatizada.
3. [docs/00_SYSTEM_ARCHITECTURE_MASTER.md](docs/00_SYSTEM_ARCHITECTURE_MASTER.md) — mapa de arquitectura y estado implementado vs. planificado.

## Objetivo del producto

Private Balance es una app financiera local-first para profesionales independientes: ingresos, gastos, agenda, temporadas y reportes con los datos en el dispositivo del usuario. La red y los servicios externos (n8n, Neon, Evolution API, OpenAI) son opcionales y nunca deben convertirse en la fuente de verdad del dominio financiero.

## Principios que no se negocian

- Local-first y offline-first: el núcleo financiero debe seguir funcionando sin conexión.
- Los cálculos financieros son sagrados: no se modifican sin autorización explícita ni se altera un balance histórico.
- Fail-closed: ante una inconsistencia se rechaza la operación, nunca se inventa un valor ni se degrada silenciosamente una garantía.
- Provider-neutral: toda integración externa (IA, WhatsApp, automatización) vive detrás de un adaptador; el dominio no depende de un proveedor concreto.
- Secretos fuera del cliente: ninguna clave ni token de servidor se expone en variables `VITE_*`, en el bundle ni en el APK.

## Estructura del repositorio (resumen)

- `src/pages`, `src/components` — UI por pantalla y componentes reutilizables.
- `src/services` — lógica de dominio y acceso a datos (ingresos, gastos, licencias, backup, exportación, moneda).
- `src/database` — Dexie/IndexedDB, incluidas las migraciones versionadas.
- `src/intelligence` — capa de IA/insights: resolución de intención, herramientas financieras de solo lectura, motores de insights/planificación/coaching. Provider-neutral por diseño.
- `src/application` — servicios de aplicación que conectan la UI con el motor de IA sin acoplarla a Dexie ni al proveedor.
- `api/`, `server/` — Vercel Functions y utilidades de servidor (licencias, automatización, canal de comunicación).
- `docs/` — documentación técnica extensa; ver [docs/README.md](docs/README.md) para el índice completo.
- `android/`, `capacitor.config.ts` — empaquetado Android.
- `test/`, `tests/` — pruebas Vitest.

## Comandos principales

```bash
npm install
npm run dev              # entorno de desarrollo
npm run build             # tsc -b && vite build
npm run lint               # ESLint
npm run test               # Vitest
npm run test:indexeddb     # migraciones Dexie en navegador real
npm run android:sync       # build + cap sync android
```

## Convenciones

- TypeScript estricto, módulos ES. Mantener el estilo existente antes de refactorizar.
- No introducir dependencias sin justificación explícita en el cambio.
- No mezclar en un mismo cambio UI, persistencia y reglas de negocio salvo que el cambio lo requiera intrínsecamente.
- Nombres de dominio claros y estables: income, expense, appointment, license, communication channel.

## Reglas de privacidad

- Ningún dato financiero se envía a un servicio externo sin que el usuario haya activado explícitamente esa integración (automatización, WhatsApp, backup a Drive, asistente con IA real).
- Si se añade una nueva llamada de red desde el cliente, documentar en [docs/PRIVACY.md](docs/PRIVACY.md) qué datos salen y hacia dónde.
- La IA (resolución de intención, herramientas financieras, proveedor OpenAI) puede leer datos financieros para responder, pero nunca debe escribirlos ni modificarlos automáticamente.

## Reglas para manipular datos y persistencia

- Cualquier cambio de esquema en Dexie requiere una migración versionada en `src/database/migrations` y validación con `npm run test:indexeddb` sobre datos reales, nunca solo con mocks.
- No usar `ORDER BY updated_at DESC LIMIT 1` sin filtrar por `user_code`/`device_code` en consultas del backend ligero (`server/`, `api/`).
- Los ajustes, ingresos y egresos no deben colapsarse entre sí en UI, reportes ni exportaciones.

## Reglas para cambios de UI

- Preservar el contrato visual y de navegación existente salvo que el cambio lo pida explícitamente.
- Revisar el impacto en ambos modos (Básico/Profesional) cuando el cambio toque pantallas compartidas.

## Reglas para Android y PWA

- Mantener compatibilidad simultánea con web y Android: no introducir una dependencia o API que solo funcione en uno de los dos entornos sin una capa de compatibilidad.
- La app es instalable como PWA (manifest + iconos) pero **no** tiene un service worker activo (`vite-plugin-pwa` no está registrado en `vite.config.ts`); no asumir caché offline de assets al documentar o implementar funcionalidad.
- Antes de tocar `capacitor.config.ts` o `android/`, revisar [docs/08_DEPLOYMENT.md](docs/08_DEPLOYMENT.md).

## Proceso de validación antes de cerrar un cambio

1. `npm run lint`
2. `npm run test` (y `npm run test:indexeddb` si el cambio toca Dexie)
3. `npm run build`
4. Revisar `git status`/`git diff` completo, sin cambios accidentales fuera del alcance.
5. Actualizar la documentación afectada (Constitución, ADR, changelog) si el cambio altera una regla o arquitectura vigente.

## Archivos que no deben modificarse sin justificación explícita

- `docs/PRIVATE_BALANCE_CONSTITUTION.md` — solo mediante una ADR nueva aceptada.
- `src/services/signedLicenseService.ts` y `server/automationSecurity.ts` — lógica de verificación de licencia y de seguridad de automatización.
- Cualquier archivo de migración ya aplicado en `src/database/migrations` o `server/migrations` — no editar una migración existente; añadir una nueva.
- `vite.config.ts` en la sección `FORBIDDEN_CLIENT_SECRETS` — es una barrera de seguridad, no un detalle de configuración incidental.

## Requisitos explícitos para cualquier agente de IA

- No afirmar que una funcionalidad está implementada sin verificarla en el código. Si hay duda, marcarla como pendiente de validar.
- No enviar datos financieros a un servicio externo (incluido un proveedor de IA) sin consentimiento explícito ya activado por el usuario en la configuración de la app.
- Mantener compatibilidad con web y Android en cualquier cambio de plataforma o almacenamiento.
- Revisar el impacto offline de cualquier cambio que toque red, sincronización o automatización.
- Ante contradicción entre este archivo y `docs/PRIVATE_BALANCE_CONSTITUTION.md`, prevalece la Constitución.

## Reglas obligatorias sobre secretos y claves de firma

- Nunca leer, imprimir, registrar en logs ni citar textualmente el contenido de un archivo que parezca contener un secreto (claves privadas, tokens, credenciales), aunque el nombre del archivo sugiera que es de prueba.
- Nunca incluir una JWK privada (cualquier objeto con campo `d`, `privateKey` o equivalente) en código, tests, fixtures, documentación o ejemplos. Los ejemplos de formato deben usar marcadores explícitos como `REPLACE_WITH_PUBLIC_COMPONENT`, nunca claves generadas realmente.
- No modificar material de firma de licencias (`publicLicenseKeyJwk` en `src/services/signedLicenseService.ts` / `server/automationSecurity.ts`, o cualquier script bajo `scripts/generate-*license*`) sin autorización explícita del propietario; ver [docs/KEY_ROTATION_RUNBOOK.md](docs/KEY_ROTATION_RUNBOOK.md).
- No introducir claves privadas reales ni generadas en fixtures de tests; usar siempre valores sintéticos claramente ficticios.
- Antes de generar una clave o licencia con `scripts/generate-license-keys.mjs` o `scripts/generate-signed-license.mjs`, revisar `.gitignore` y confirmar que la ruta de salida queda fuera del árbol versionado del repositorio; nunca usar una ruta personalizada dentro del repositorio para una clave privada.
- Nunca registrar (en logs, `console.debug`, trazas o documentación) el valor de campos privados como `d`, `privateKey`, `LICENSE_PRIVATE_KEY_JWK` o equivalentes.

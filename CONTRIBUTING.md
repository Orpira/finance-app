# Contribuir a Private Balance

Gracias por tu interés en contribuir. Este documento resume el flujo esperado. Para reglas de negocio y arquitectura, la fuente de verdad es [docs/PRIVATE_BALANCE_CONSTITUTION.md](docs/PRIVATE_BALANCE_CONSTITUTION.md); para agentes de IA, ver [AGENTS.md](AGENTS.md).

## Preparación del entorno

```bash
git clone https://github.com/Orpira/finance-app.git
cd finance-app
npm install
cp .env.example .env.local
npm run dev
```

Node.js compatible con Vite 8. No se necesita backend propio para el desarrollo básico del núcleo financiero; las variables de automatización/IA solo son necesarias si vas a trabajar en esas áreas (ver [docs/AUTOMATION_HUB.md](docs/AUTOMATION_HUB.md)).

## Flujo de ramas

- `main` es la rama estable de trabajo.
- Crea una rama descriptiva por cambio, por ejemplo `fix/income-report-status` o `feat/agenda-recurring-appointments`.
- No hagas commits directos a `main` para cambios no triviales.

## Convención de commits

El historial del proyecto usa mensajes cortos con prefijo de tipo, por ejemplo:

```text
fix(income): scope pending-report summary to the active season
feat(seasons): collapse long lists and add read-only detail popups
style(app): remove border from floating theme toggle button
```

Prefijos habituales: `feat`, `fix`, `style`, `refactor`, `test`, `docs`, `chore`. El mensaje debe explicar el porqué del cambio, no solo repetir el nombre del archivo tocado.

## Requisitos de calidad antes de un Pull Request

```bash
npm run lint
npm run test
npm run build
```

Si el cambio toca Dexie/IndexedDB, ejecuta además:

```bash
npm run test:indexeddb
```

Un cambio no se considera terminado si alguno de estos comandos falla por causa del propio cambio. Si falla por una razón preexistente y no relacionada, indícalo explícitamente en el PR en lugar de ocultarlo.

## Privacidad

- No agregues una llamada de red desde el cliente sin documentar en [docs/PRIVACY.md](docs/PRIVACY.md) qué datos salen y hacia dónde.
- No envíes datos financieros a un proveedor externo (incluida IA) sin que exista un consentimiento explícito del usuario ya activado en la configuración.
- No incluyas datos personales o financieros reales en ejemplos, capturas, tests o commits.

## Cambios de esquema (Dexie)

- Toda modificación de tablas requiere una migración nueva y versionada en `src/database/migrations`, nunca editar una migración ya aplicada.
- Valida la migración con `npm run test:indexeddb` sobre un navegador real, no solo con mocks.
- Documenta el cambio de esquema en `docs/architecture/03_DATA_MODEL.md` si corresponde.

## Cambios PWA

- El proyecto no tiene actualmente un service worker activo (`vite-plugin-pwa` no está registrado en `vite.config.ts`). Si tu cambio lo activa, documenta el impacto en caché/offline y en `docs/00_SYSTEM_ARCHITECTURE_MASTER.md`.

## Cambios Android

- Prueba con `npm run android:sync` antes de abrir el PR si el cambio afecta plugins nativos, permisos o `capacitor.config.ts`.
- No relajes las reglas de `android/app/proguard-rules.pro` sin justificación explícita.

## Pull Requests

- Usa la plantilla de PR del repositorio.
- Un PR debe tener un alcance identificable: evita mezclar una funcionalidad nueva con refactors no relacionados.
- Indica explícitamente el impacto en privacidad, persistencia, PWA y Android, aunque sea "ninguno".

## Documentación obligatoria

Si el cambio altera una regla de negocio, una decisión de arquitectura o el comportamiento documentado, actualiza el documento correspondiente en el mismo PR:

- Regla de negocio o principio técnico → `docs/PRIVATE_BALANCE_CONSTITUTION.md` (requiere una ADR si es una excepción).
- Decisión arquitectónica nueva → `docs/DECISIONS.md`.
- Cambio funcional relevante → `docs/CHANGELOG.md`.

## Definición de terminado

Un cambio está terminado cuando:

1. Lint, tests y build pasan (o los fallos preexistentes están identificados y no relacionados).
2. La documentación afectada está actualizada.
3. `git status`/`git diff` no muestran cambios fuera del alcance declarado.
4. No se expone ningún secreto, credencial ni dato personal real.

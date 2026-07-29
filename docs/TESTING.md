# Testing

Disciplina de pruebas y enforcement mecánico adoptados para el rediseño del
trial idempotente (ver [TRIAL_FLOW.md](TRIAL_FLOW.md)). Para la estrategia
general de pruebas del resto del proyecto, ver
[architecture/12_TESTING.md](architecture/12_TESTING.md).

## 1) Disciplina TDD (red → green → refactor)

Para cada unidad de comportamiento nueva, en este orden:

1. **RED**: escribir el test primero. Ejecutarlo y confirmar que falla por
   la razón correcta (comportamiento faltante, no un import roto o un typo).
2. **GREEN**: escribir el mínimo código de producción que lo hace pasar.
3. **REFACTOR**: limpiar manteniendo la suite en verde.

Los tests siguen el estilo ya establecido en el repo (ver
`test/backupService.test.ts`): `import { describe, expect, it } from 'vitest'`,
funciones puras siempre que sea posible, mocks solo cuando hace falta cruzar
un límite real (red, DB, crypto con secretos), nombres de test en español.

## 2) Cómo correr los tests

```bash
npm test                # vitest run — suite completa
npx vitest run <file>   # un archivo puntual, útil para el ciclo RED/GREEN
npm run typecheck       # tsc --noEmit sobre app (tsconfig.app.json) y api (tsconfig.api.json)
npm run lint             # eslint .
npm run build            # build de producción completo (tsc -b && vite build)
```

## 3) Enforcement mecánico

La disciplina no depende de que alguien se acuerde de correr los checks a
mano: está reforzada en dos capas independientes.

### Git hooks (`lefthook.yml`)

- `pre-commit`: corre `eslint` y `npm run typecheck` sobre los archivos
  `.ts`/`.tsx` en stage. Si hay errores, el commit se bloquea.
- `pre-push`: corre `npm test` (suite completa). Si algún test falla, el
  push se bloquea.

Se instalan automáticamente tras `npm install` vía el script `prepare`
(`lefthook install`). Para reinstalarlos a mano: `npx lefthook install`.

### CI (`.github/workflows/ci.yml`)

En cada push y pull request a `main`, sobre Node 22: `npm ci` → `eslint .`
→ `tsc -p tsconfig.app.json --noEmit` → `tsc -p tsconfig.api.json --noEmit`
→ `vitest run`. Un PR con CI en rojo no debería mergearse (requiere
configurar branch protection en GitHub aparte; eso queda fuera del
alcance de este repositorio, es configuración del proyecto en GitHub).

## 4) Escenario de pruebas del trial idempotente (bloques A–D)

Cobertura específica del rediseño descrito en
[TRIAL_FLOW.md](TRIAL_FLOW.md), de abajo hacia arriba:

| Bloque | Qué prueba | Archivo(s) | Sin red/DB |
| --- | --- | --- | --- |
| A — Elegibilidad pura | `resolveTrialDecision`: issue/reactivate/expired/clock-tampered según `{now, existing}` | `test/trialEligibility.test.ts` | Sí, función pura |
| B — Servicio idempotente | `issueOrReactivateTrial` sobre `InMemoryTrialGrantsRepository`; incluye verificación real de firma contra la clave pública del trial | `test/trialLicenseService.test.ts` | Sí, doble en memoria + par de claves de prueba generado en el momento |
| C — Contrato del endpoint | `api/trial-start.ts`: body inválido, issued, reactivated, expired, clock-tampered | `test/trialStartEndpoint.test.ts` | Sí, `issueOrReactivateTrial` mockeado |
| D — Cliente sin React | `deriveTrialState` (elegibilidad) y `runTrialFlow` (reintentos acotados: máx. 2, nunca bucle) | `test/trialClientFlow.test.ts` | Sí, lógica extraída de `LicenseGuard.tsx` |

Tests relacionados que no forman parte de los bloques pero cubren el mismo
flujo end-to-end:

- `test/trialService.test.ts` — contrato HTTP de `attemptFreeTrial`
  (incluye el mapeo de `outcome` en el body 409 a `expired`/`clock-tampered`).
- `test/apiBaseUrl.test.ts` — que `trial-start` y `license-activate` nunca
  resuelvan a orígenes distintos.
- `test/automationTrialSignature.test.ts` — que el verificador de firma del
  servidor (`server/automationSecurity.ts`) acepte licencias trial y siga
  rechazando firmas que no coinciden.

Bloque B, caso "el activationCode reactivado verifica correctamente contra
la clave pública del trial", es deliberado: es exactamente el tipo de test
que habría atrapado en rojo, antes de deploy, el bug de claves de firma
descubierto en producción que motivó este rediseño.

## 5) Marcador pendiente

`test/trialEligibility.test.ts` incluye
`it.todo('ancla el trial por email para bloquear reinstalación')` como
recordatorio vivo del siguiente incremento de producto (ver TRIAL_FLOW.md
§7). Un `it.todo` no falla la suite; aparece como pendiente en el reporte
de vitest.

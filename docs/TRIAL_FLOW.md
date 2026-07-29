# Flujo del trial autoservicio de 7 días

Documento dedicado al auto-trial idempotente. Para el contexto de por qué
existe una clave de firma separada para trials y el resto del registro de
dispositivos por licencia, ver
[LICENSE_DEVICE_REGISTRY.md](LICENSE_DEVICE_REGISTRY.md).

## 1) Por qué idempotente

El diseño original trataba "este dispositivo ya tiene un trial" como un
error (`409 TrialAlreadyUsedError`). Eso rompía el caso normal de uso: un
dispositivo con trial vigente que **reabre la app** volvía a llamar a
`/api/trial-start`, recibía `409`, caía a la pantalla de activación manual,
el usuario reintentaba, `409` de nuevo — un bucle sin salida para un
dispositivo que en realidad tiene acceso legítimo.

El rediseño separa dos cosas que antes eran una sola: "¿ya existe una fila
para este dispositivo?" (siempre fue una pregunta de infraestructura) de
"¿qué significa esa fila ahora mismo?" (una decisión de negocio que depende
del reloj). Un trial **vigente** ya no es un error: se **reactiva**.

## 2) Diagrama de estados (cliente)

```text
                    ┌─────────────┐
                    │  eligible   │  (inactive, sin ninguna licencia local)
                    └──────┬──────┘
                           │ runTrialFlow (máx. 2 intentos, backoff)
              ┌────────────┼─────────────────┬───────────────────┐
              │            │                 │                   │
        outcome:      outcome:          outcome:             fallo transitorio
        granted       expired          clock-tampered         (red/servidor/
        (issued o                                              activación)
        reactivated)                                           reintenta hasta
              │            │                 │                 agotar el límite
              ▼            ▼                 ▼                       │
      ┌───────────┐ ┌─────────────┐  ┌─────────────────┐             ▼
      │  active   │ │trial-expired│  │ clock-tampered   │      ┌───────────┐
      │(children) │ │  (compra)   │  │ (misma pantalla  │      │   error   │
      └───────────┘ └─────────────┘  │  que licencia    │      │(reintentar│
                                      │  con reloj        │      │ manual)   │
                                      │  manipulado)      │      └───────────┘
                                      └─────────────────┘
```

`trial-expired` y `clock-tampered` reutilizan las pantallas ya existentes
de `LicenseActivationPage` (`mode="expired"` / `mode="clock-tampered"`);
no son estados visuales nuevos, son outcomes nuevos que se mapean sobre el
`GuardStatus` que `LicenseGuard.tsx` ya manejaba.

## 3) Tabla de decisión — `resolveTrialDecision` (`server/trialEligibility.ts`)

Función **pura**, sin red ni DB: `{ now: Date, existing: { issuedAt, expiresAt } | null } → TrialDecision`.

| `existing` | `issuedAt` vs `now` | `expiresAt` vs `now` | `decision` |
| --- | --- | --- | --- |
| `null` | — | — | `issue` |
| fila | `issuedAt <= now` | `expiresAt > now` | `reactivate` |
| fila | `issuedAt <= now` | `expiresAt <= now` (**inclusive**) | `expired` |
| fila | `issuedAt > now` | — | `clock-tampered` |

El límite `expiresAt === now` se considera **vencido** (inclusivo), no
vigente. La comprobación de `clock-tampered` tiene prioridad sobre
`expired`: un `issuedAt` futuro es en sí mismo la señal de manipulación,
independientemente de dónde caiga `expiresAt`.

## 4) Contrato del endpoint — `POST /api/trial-start`

Body: `{ deviceCode, userCode, platform }` (igual que antes, sin cambios).

| Escenario | HTTP | Body |
| --- | --- | --- |
| Body inválido (zod) | `400` | `{ error }` |
| Device nuevo | `200` | `{ outcome: 'issued', activationCode, expiresAt, deviceAuthorization, activeDevices, maxDevices }` |
| Device con trial vigente | `200` | `{ outcome: 'reactivated', activationCode, expiresAt, deviceAuthorization, activeDevices, maxDevices }` |
| Device con trial expirado | `409` | `{ outcome: 'expired', error }` |
| Reloj manipulado (`issuedAt` futuro) | `409` | `{ outcome: 'clock-tampered', error }` |
| Límite de dispositivos / licencia revocada (`LicenseRegistryError`) | `409` / `403` | `{ error }` (sin `outcome`, es un caso ajeno al trial en sí) |

`activationCode` en una reactivación es un código **nuevo** (firma
distinta, `issuedAt` de la firma actualizado) pero con el **mismo
`expiresAt`** que la fila original en `trial_grants`: la reactivación nunca
extiende la ventana de 7 días.

### Nota de implementación: `license_devices` no deduplica reactivaciones

Cada reactivación firma un `activationCode` distinto, y `license_key` se
deriva como `sha256(activationCode)` (ver
`server/trialLicenseSecurity.ts#getSignedLicenseKey`). Esto significa que
cada reactivación crea una fila **nueva** en `licenses`/`license_devices`
(con su propio `license_key`), en vez de reutilizar la de la emisión
original. No es un bug funcional — `devicePolicy: 'single'` +
`maxDevices: 1` sigue autorizando correctamente el dispositivo en cada
fila nueva — pero sí es acumulación de filas en `license_devices` por cada
reactivación de un mismo trial. Aceptado como trade-off del rediseño; si en
el futuro se vuelve un problema de volumen, la solución es que
`issueOrReactivateTrial` reutilice el `license_key` de la fila original en
vez de derivarlo del `activationCode` nuevo.

## 5) `TrialGrantsRepository` (`server/trialGrantsRepository.ts`)

```ts
interface TrialGrantRow {
  deviceCode: string
  userCode: string | null
  issuedAt: string
  expiresAt: string
}

interface TrialGrantsRepository {
  findByDeviceCode(deviceCode: string): Promise<TrialGrantRow | null>
  insert(row: TrialGrantRow): Promise<void>
}
```

Dos implementaciones:

- `InMemoryTrialGrantsRepository` — doble en memoria, usado por
  `test/trialLicenseService.test.ts` para probar `issueOrReactivateTrial`
  sin Neon ni CI con base de datos.
- `neonTrialGrantsRepository` (`server/neonTrialGrantsRepository.ts`) —
  implementación real, crea el esquema de `trial_grants` de forma
  idempotente (igual que el diseño anterior) y es la que usa
  `api/trial-start.ts` en producción.

## 6) Política de reintentos (cliente) — `runTrialFlow` (`src/services/trialFlow.ts`)

Máximo **2 intentos** por refresh de `LicenseGuard` (constante
`DEFAULT_MAX_ATTEMPTS`, configurable por parámetro). `granted`, `expired` y
`clock-tampered` son finales: paran el bucle de inmediato. Solo los
outcomes transitorios (`network-error`, `server-error`,
`activation-error`) se reintentan; al agotar el límite sin éxito, el
resultado es `{ state: 'error', detail }` — nunca un reintento indefinido.
`LicenseGuard.tsx` ya no tiene ningún `catch {}` vacío en el camino del
trial: cada outcome tiene un manejo explícito.

`deriveTrialState` decide la elegibilidad por separado: solo una
instalación nueva sin **ninguna** licencia local (ni siquiera una inactiva)
es candidata a intentar el trial.

## 7) Próximo incremento (no implementado): anclaje por email

Hoy el trial se ancla únicamente a `deviceCode`. Borrar los datos de la app
o reinstalar genera un `deviceCode` nuevo y permite reclamar otro trial —
limitación conocida y aceptada por ahora (ver
[LICENSE_DEVICE_REGISTRY.md](LICENSE_DEVICE_REGISTRY.md)).

Cuando se decida cerrar ese hueco, la extensión natural es que
`resolveTrialDecision` y `TrialGrantsRepository` razonen sobre una
identidad de trial abstracta (`{ kind: 'device', value }` hoy;
`{ kind: 'email', value }` como alternativa o complemento futuro) en vez de
un `deviceCode` crudo, para que anclar por email sea una nueva
implementación de identidad y no un rediseño del flujo. Marcador vivo:
`it.todo('ancla el trial por email para bloquear reinstalación')` en
`test/trialEligibility.test.ts`.

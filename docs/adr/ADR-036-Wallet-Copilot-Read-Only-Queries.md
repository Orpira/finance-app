# ADR-036 - Consultas de solo lectura de Wallets personales en el Copiloto

**Estado:** Accepted
**Fecha:** 2026-09-08
**Autorizacion:** solicitud directa del propietario (especificacion "PRIVATE BALANCE — INTEGRACIÓN DE WALLETS PERSONALES EN EL COPILOTO")

## Contexto

Private Balance ya soporta Wallets personales (`src/services/walletService.ts`)
y transferencias internas entre ellas (`src/services/internalTransferService.ts`),
correctamente excluidas de ingresos/egresos/balance/metas. El Copiloto, sin
embargo, no podia responder preguntas sobre donde esta el dinero ("¿cuanto
tengo en casa?", "¿como esta distribuido mi dinero?") — solo sobre el
resultado financiero del periodo (ingresos/egresos/balance mensual).

Sin esta distincion, "¿Cuanto dinero tengo?" caia por defecto en la ruta
generica `financial_balance` del mes actual (ver
`deterministicIntentResolver.ts`), una respuesta incorrecta: el usuario
pregunta por el saldo acumulado en sus Wallets, no por el resultado del mes.

## Decision

Se anaden dos conceptos deliberadamente separados, nunca mezclados:

```text
Resultado financiero  = ingresos - egresos (+ ajustes/adicionales, metas, temporadas)
Distribucion de dinero = saldo por Wallet, derivado de ingresos/egresos/transferencias
                          internas ya aplicados a cada walletId
```

Una transferencia interna **nunca** cambia el resultado financiero (ya
garantizado por el dominio existente — `InternalTransfer` nunca escribe en
`db.services`/`db.expenses`); solo redistribuye el saldo entre Wallets. El
Copiloto debe reflejar exactamente esa invariante y nunca sumar las dos caras
de una transferencia ("total movido" cuenta el importe una sola vez).

### Arquitectura

Se sigue el patron ya existente de dos capas (`financialCopilotEngine.ts` +
`financialCopilotService.ts`), replicado para Wallets:

- **`src/intelligence/deterministic-copilot/walletCopilotEngine.ts`** (puro,
  sin acceso a Dexie, sin dependencia de proveedor de IA): clasifica la
  intencion (`detectWalletCopilotIntent`), extrae parametros (nombre de
  Wallet, periodo) y formatea las respuestas. Nunca calcula un saldo por su
  cuenta — solo formatea numeros que ya le llegan calculados.
- **`src/services/personalWalletCopilotService.ts`** (orquestador): resuelve
  la intencion, aplica la puerta de modo de uso (`resolveActiveUsageMode`) y
  delega cada cifra en `walletService.getPersonalWalletLedger` /
  `internalTransferService.getWalletTransferSummary` /
  `getLatestWalletTransfer` — las mismas funciones de lectura ya usadas por
  `WalletActivityCard`/`SettingsWalletsPage`, nunca una ruta paralela.
- **Cableado**: `financialCopilotService.ts`'s
  `createLocalFinancialCopilotQueryHandler().answer()` comprueba
  `detectWalletCopilotIntent(query)` **antes** de las rutas financieras
  existentes. Esto es lo que hace que "¿cuanto dinero tengo?" nunca caiga en
  `financial_balance` — se resuelve como distribucion de Wallets por
  construccion, sin tocar ningun patron financiero validado.

### Nuevas intenciones

`wallet_total`, `wallet_balance`, `wallet_distribution`, `wallet_count`,
`wallet_default`, `wallet_largest_balance`, `wallet_smallest_balance`,
`wallet_transfers_summary`, `wallet_latest_transfer` — todas de solo lectura.
Ninguna crea, transfiere, edita ni archiva una Wallet; un comando imperativo
("Transfiere 100€ a Casa") nunca se clasifica como intencion de lectura.

### Ambiguedad de nombres

`findWalletsByQuery` (motor puro) prioriza, en orden: coincidencia exacta con
`wallet.normalizedName` (ya normalizado por `buildNormalizedWalletName` —
insensible a mayusculas/tildes/espacios) → alias documentado en una tabla
cerrada (`casa`→"Dinero en casa", `cuenta principal`, `efectivo`, `banco`) →
coincidencia parcial. Si hay mas de una coincidencia parcial sin ganador
exacto, se responde con la lista y se pide aclaracion — nunca se suma ni se
elige arbitrariamente. Una Wallet inexistente nunca devuelve 0 (se
distingue explicitamente de una Wallet existente con saldo cero).

### Contexto Personal/Profesional/Hibrido

La puerta se aplica en `personalWalletCopilotService.ts` via
`resolveActiveUsageMode(settings) !== 'basic'`, el mismo mecanismo que ya usa
el resto de la app (Movimientos, ingresos, egresos) — no una comprobacion
nueva. En Profesional (incluido Hibrido con `activeContext: 'professional'`),
ninguna cifra ni nombre de Wallet se calcula ni se expone: la respuesta es un
mensaje generico de "cambia al espacio Personal", devuelto antes de leer
`getPersonalWalletLedger`.

### Monedas

Las respuestas usan `settings.defaultCurrency`. A diferencia de
ingresos/egresos (que guardan valoraciones historicas en
`eurValue`/`copValue`/`secondaryCurrencyValue`), `InternalTransfer` solo
guarda un `amount`+`currency` unico — no hay valoracion multi-moneda
historica para transferencias. Por eso el soporte de moneda del Copiloto de
Wallets queda limitado a `defaultCurrency` en esta primera entrega; pedir un
saldo en otra moneda con transferencias involucradas quedaria fuera de
alcance honesto (no se inventa una conversion con el tipo de cambio actual).

## Consecuencias

- Las respuestas de Wallets nunca alteran `financialCopilotService.loadSnapshot()`
  (verificado en `test/personalWalletCopilotService.test.ts`, escenario
  §39/§42/§52): la transferencia interna cambia la distribucion pero no
  ingresos/egresos/balance.
- El motor financiero (`financialCopilotEngine.ts`) queda intacto — solo se
  amplio la union de tipos `FinancialCopilotQueryIntent` con los nuevos
  intents de Wallets para que compartan el mismo contrato de respuesta
  (`FinancialCopilotQueryAnswer`).
- Limitacion conocida y documentada: sin conversion de moneda para
  transferencias fuera de `defaultCurrency`; sin acciones de navegacion
  clicables en el chat (el contrato actual de `ChatMessage` solo soporta un
  `recommendedAction` de texto libre, no botones con `href` — construir eso
  seria alcance nuevo no solicitado); sin cambios en Quick Actions.

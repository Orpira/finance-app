# ADR-037 - Reporte de Wallets: separar entradas/salidas externas de transferencias internas

**Estado:** Accepted
**Fecha:** 2026-09-08
**Autorizacion:** solicitud directa del propietario (especificacion "PRIVATE BALANCE — AJUSTE DEL REPORTE DE WALLETS")
**Relacionado:** [ADR-036](./ADR-036-Wallet-Copilot-Read-Only-Queries.md) (misma separacion conceptual, aplicada al Copiloto en vez de al reporte)

## Contexto

El "Reporte de wallets" (`src/pages/Reports/ReportsPage.tsx`, `kind === 'wallet'`)
ya excluia correctamente las transferencias internas de "Ingresos por
categoria"/"Egresos por categoria" — financieramente correcto (una
transferencia nunca es un ingreso ni un egreso). Pero el reporte no mostraba
en ningun lado *como* llego el dinero a una Wallet via transferencia, asi que
un caso como:

```text
+350 € → Depositos
10 € Depositos → Comida
-10 € Comida → Proteina
```

dejaba a la Wallet "Comida" con "Ingresos: 0 €, Egresos: 10 €" sin explicar de
donde salieron esos 10 € para poder gastarlos — la transferencia que los trajo
simplemente no aparecia en el reporte de esa Wallet.

Ademas, el saldo mostrado en la tabla resumen (`walletBalances`) era siempre
el saldo **actual** (todo el historial, ignorando el rango de fechas del
reporte) mientras que las cifras de actividad de al lado si respetaban el
periodo — dos fuentes de tiempo distintas en la misma fila, imposibles de
conciliar entre si.

## Decision

### Terminologia

Se adopta la jerarquia que exige la especificacion:

```text
Entradas a la Wallet          Salidas de la Wallet
├── Ingresos externos         ├── Egresos
└── Transferencias recibidas  └── Transferencias enviadas
```

"Ingreso" deja de usarse como sinonimo de "cualquier entrada a una Wallet".
Los calculos financieros globales (Ingresos/Egresos/Transferencias internas)
no cambian — solo se hicieron visibles dentro del reporte por Wallet.

### Modelo de reporte puro (`src/services/walletReportService.ts`)

Nuevo modulo puro y testeable con `buildWalletReportModel(input)`, la unica
fuente de verdad que Vista previa, PDF y "Compartir PDF" comparten (los tres
ya consumian el mismo objeto `{html, text, title}` de `buildReport()`; el
cambio fue *que* construye ese objeto para `kind === 'wallet'`, no la forma
en que se distribuye a los tres destinos).

Por cada Wallet, calcula:

```text
openingBalance  = movimientos ANTERIORES al periodo (o 0 si no hay periodo — spec §9)
closingBalance  = openingBalance
                + externalIncomeTotal + transferReceivedTotal
                - expenseTotal - transferSentTotal
                + adjustmentTotal
```

Reutiliza `buildBalanceReport` (`balanceReportService.ts`, ya usado por el
reporte de Balance general) para separar ajustes (`isAdjustmentIncome` /
`expense.type === 'ajuste'`) de ingresos/egresos reales — no se reimplementa
ese calculo (spec §14): `externalIncomeTotal`/`expenseTotal`/`adjustmentTotal`
de una Wallet son exactamente `incomeGrossTotal`/`expenseTotal`/
`adjustmentImpactTotal` de `buildBalanceReport` filtrado a los movimientos de
esa Wallet. Como `getStoredIncomeValue` (usado tanto por `buildBalanceReport`
como por `getWalletBalance`) ya suma principal + Adicionales (ADR-035), el
saldo de Wallet reportado siempre concilia con el detalle de cada ingreso sin
una diferencia inexplicable.

Las transferencias se derivan directamente de `InternalTransfer` filtrando
`fromWalletId`/`toWalletId` — la misma transferencia, vista desde ambas
Wallets, nunca duplicada: la seccion de origen la muestra en "Transferencias
enviadas" (signo `-`) y la de destino en "Transferencias recibidas" (signo
`+`), ambas derivadas del mismo registro `transfer.id`.

### Saldo inicial del periodo (spec §8)

`ReportsPage.tsx` ya cargaba `traceIncomes`/`traceExpenses` (todo el
historico, sin filtro de fecha) para otro proposito; se reutilizan sin
duplicar la carga, junto con un nuevo estado `allTransfers` (antes solo se
guardaba `periodTransfers`, ya filtrado). El modelo separa cada coleccion en
"antes del periodo" (para `openingBalance`) y "dentro del periodo" (para la
actividad mostrada) — se elimina por completo el estado `walletBalances` y su
llamada async a `getWalletBalance` (saldo actual, independiente del periodo),
que era la causa raiz de la inconsistencia.

### Filtros adicionales de la UI (pais/ciudad/tipo de pago/categoria/temporada)

El resumen numerico de cada Wallet (saldo inicial/final, totales) se calcula
siempre sobre el historico completo, **sin** los filtros adicionales de la
pagina de Reportes, porque debe conciliar exactamente con la formula
verificada por las pruebas (spec §7/§32) — aplicar esos filtros ahi rompuria
esa invariante. Las secciones "Ingresos externos por categoria"/"Egresos por
categoria" (detalle, no el resumen) si siguen respetando esos filtros, igual
que antes de este cambio.

### Moneda (spec §26/§41)

`InternalTransfer` no guarda valoracion multi-moneda historica (a diferencia
de ingresos/egresos). Una transferencia en una moneda distinta a la del
reporte se excluye de los totales — nunca se trata como 0 sin mas: la
seccion de esa Wallet y el modelo completo marcan
`hasCurrencyMismatchTransfers: true`, y el reporte muestra una nota explicita.

### Validacion fail-closed (spec §36)

`buildWalletReportModel` lanza `WalletReportIntegrityError` si: una Wallet no
pertenece a `usageMode: 'basic'`, o una transferencia referencia un
`walletId` que no existe en la lista de Wallets recibida — nunca se inventa
"Wallet no disponible" silenciosamente ni se genera un reporte parcial;
`ReportsPage.tsx` captura el error y muestra un mensaje controlado.

## Consecuencias

- El criterio de aceptacion del spec (`§52`) se cumple exactamente: para
  "Comida" el reporte muestra Ingresos externos 0 €, Transferencias recibidas
  10 €, Egresos 10 €, Saldo final 0 €; para "Depositos", Ingresos externos
  350 €, Transferencias enviadas 10 €, Saldo final 340 €.
- `totalAvailable` (suma de `closingBalance`) nunca cambia por transferir,
  porque `SUMA(transferReceivedTotal) = SUMA(transferSentTotal)` en todo el
  conjunto de Wallets — verificado en pruebas.
- Wallets archivadas con saldo o actividad siguen apareciendo en un reporte
  historico; una archivada totalmente vacia deja de listarse.
- Limitacion conocida (igual que en ADR-036): sin conversion de moneda para
  transferencias fuera de la moneda del reporte.

# ADR-035 - Ingresos excluye Adicionales; solo el principal cuenta como Ingresos y Ganancia

**Estado:** Accepted
**Fecha:** 2026-09-03
**Autorizacion:** explicita del propietario (confirmacion directa del ejemplo de referencia)
**Sustituye:** [ADR-033](./ADR-033-ADDITIONALS-INCOME-NOT-PROFIT.md) en la definicion de "Ingresos";
conserva vigente el resto de ADR-033 (Ganancia/Ahorro/Meta ya excluian Adicionales).

## Contexto

ADR-033 definio `Ingresos = P + A` (principal + Adicionales) y `Ganancia = P`.
La revision UX de Inicio detecto que esa definicion de "Ingresos" no es
comprensible para un usuario nuevo: la tarjeta "Ingresos" mostraba un importe
que ya incluia los Adicionales, mientras que el propietario confirmo
explicitamente el siguiente comportamiento de referencia como el correcto:

```text
Ingreso base = 80 €
Adicional = 10 €
Egresos = 10 €

Ingresos (tarjeta)  = 80 €   (el adicional NO se suma a Ingresos)
Adicionales (tarjeta) = 10 €
Ganancia = 70 €
```

Bajo ADR-033 ese mismo caso mostraba `Ingresos = 90 €`, lo cual contradice la
confirmacion explicita anterior.

## Decision

Sean `P` el principal realizado ya convertido, `A` los Adicionales convertidos
y `E` los gastos:

```text
Ingresos = P            (antes P + A)
Adicionales = A         (magnitud independiente, sin cambios)
Resultado de la temportada = P - E   (antes rotulado "Ganancia"; formula sin cambios respecto a ADR-033)
Total recibido = P + A   (solo entradas monetarias; nunca descuenta egresos)
```

`Total recibido` **no** es lo mismo que `Balance general neto`. Este ultimo
si incorpora egresos y el impacto de ajustes, y vive con nombre propio en
`buildBalanceReport` (`src/services/balanceReportService.ts`):

```text
Balance general neto = incomeGrossTotal - expenseTotal + adjustmentImpactTotal
                     = (P + A) - E + J
```

donde `J` = `adjustmentImpactTotal` (tambien expuesto como
`impactByAdjustments` en `BalanceReportResult`) = suma de ajustes positivos
menos ajustes negativos (`adjustmentsPositiveTotal - adjustmentsNegativeTotal`),
es decir, el efecto neto de los registros de tipo `ajuste` en `services`/
`expenses`, que se mantienen separados de Ingresos/Ganancia/Egresos normales
(ver `isAdjustmentIncome`, `expense.type === 'ajuste'`). `J` no es una letra
sin definir: es un campo real y nombrado en el dominio.

- `getStoredIncomePrincipalValue` sigue siendo la lectura de Ingresos **y**
  de Ganancia (antes solo de Ganancia). `calculateFinancialTotals.primaryIncome`
  / `secondaryIncome` pasan a usar `getStoredIncomePrincipalValue` en vez de
  `getStoredIncomeValue`.
- `getStoredIncomeValue` (`P + A`) deja de alimentar la tarjeta/etiqueta
  "Ingresos" en cualquier superficie. Como funcion aislada (sin egresos) es
  la lectura de "Total recibido" por ingreso/agregado; combinada con `E` y
  `J` en `buildBalanceReport` pasa a ser "Balance general neto" — son dos
  metricas distintas con nombre propio, nunca la misma etiqueta.
- `calculateFinancialTotals` expone ahora `primaryAdditionals` /
  `secondaryAdditionals` (delegando en `sumIncomeAdditionalsValue`) para que
  los consumidores no necesiten recalcular Adicionales por su cuenta.
- Meta de ingresos (`FinancialGoal.type === 'income_target'`) pasa a excluir
  Adicionales, igual que Ahorro y Meta de temporada.
- Movimientos, Meta de temporada (`calculateSeasonFinancialResult`,
  `getSeasonStatistics.realGain`) y el Balance por temporadas/general no
  cambian: ya excluian o ya declaraban explicitamente los Adicionales segun
  correspondia.
- La relacion Ingreso ↔ Adicional (`IncomeAdditional.incomeId`,
  `ServiceIncome.additionalsTotal`) no se modifica; sigue siendo trazable por
  registro.

## Alternativas

- Mantener ADR-033 y solo aclarar con microcopy que "Ingresos" incluye
  Adicionales: descartado por autorizacion explicita del propietario, que
  confirmo el ejemplo de referencia con Ingresos = 80 (no 90).
- Eliminar a los Adicionales de todo agregado, incluido "Total recibido":
  descartado; los reportes que requieren mostrar el flujo de caja completo
  (Seccion 7 del encargo) siguen pudiendo usar `getStoredIncomeValue`.
- Llamar "Total recibido" a una cifra que ya descuenta egresos: descartado;
  esa cifra se llama "Balance general neto" y vive en `buildBalanceReport`
  con nombre propio (`generalBalance`).

## Consecuencias

- No cambia el esquema Dexie ni se reescribe ningun ingreso o balance
  historico; el cambio es de lectura/agregacion, no de persistencia.
- Los registros historicos con Adicionales conservan su
  `additionalsTotal`/`IncomeAdditional` intactos; solo cambia como se
  presentan en agregados de "Ingresos".
- Balance por temporadas / Balance general mantiene su formula
  ("Ingresos brutos - Egresos + Impacto por ajustes") sin cambios, porque ya
  usaba el calificativo "brutos" para distinguirse de "Ingresos" simple.
- Cualquier superficie que hoy muestre "Ingresos" debe usar
  `getStoredIncomePrincipalValue` / `calculateFinancialTotals.primaryIncome`;
  si necesita mostrar el total efectivamente cobrado (sin egresos) debe
  rotularlo "Total recibido"; si la cifra ya descuenta egresos e impacto de
  ajustes debe rotularlo "Balance general neto" — nunca usar la misma
  etiqueta para ambas.

## Glosario de metricas (sin ambiguedad)

| Metrica | Formula | Incluye Adicionales | Incluye Egresos | Incluye Ajustes (J) |
|---|---|---|---|---|
| Ingresos | `P` | No | No | No |
| Adicionales | `A` | — | No | No |
| Resultado de la temporada (antes "Ganancia") | `P - E` | No | Si | No |
| Total recibido | `P + A` | Si | No | No |
| Balance general neto | `(P + A) - E + J` | Si | Si | Si |

## Addendum 2026-09-03 — Renombre UX de "Ganancia" a "Resultado de la temporada"

La etiqueta visible "Ganancia" (tarjeta de Inicio, Resumen completo, Balance
por temporadas/general) pasa a "Resultado de la temporada" para comunicar
explicitamente que Adicionales quedan fuera del calculo. La formula no
cambia (`P - E`). Nombres tecnicos internos (`primaryGain`, `realGain`,
`netProfit`, `netGain`) se mantienen sin cambios: son identificadores de
codigo, no texto mostrado al usuario. "Ganancia real" (=`P`, sin restar
egresos, ej. `SeasonStatistics.realGain`) es una metrica distinta —
equivale numericamente a Ingresos— y queda pendiente de revision aparte, no
se renombra en este addendum.

## Evidencia

El caso de contrato es principal 80 + Adicionales 10 - gastos 10:

```text
Ingresos = 80
Adicionales = 10
Ganancia = 70
Total recibido (si el reporte lo requiere) = 90
```

Pruebas focales: `test/financeStats.test.ts` (`calculateFinancialTotals`),
`test/financialGoalService.test.ts` (`income_target`).

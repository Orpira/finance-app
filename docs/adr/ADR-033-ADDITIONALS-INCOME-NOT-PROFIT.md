# ADR-033 - Adicionales cuentan como Ingresos, no como Ganancia

**Estado:** Superseded in part by [ADR-035](./ADR-035-INCOME-EXCLUDES-ADDITIONALS.md) — la definicion
de "Ingresos" cambio a solo principal (`P`); la exclusion de Adicionales de
Ganancia/Ahorro/Meta permanece vigente.
**Fecha:** 2026-08-28
**Autorizacion:** explicita del propietario

## Contexto

D-012 separo los Adicionales del registro principal para que nunca modificaran
`realGain`, `totalAmount` ni los snapshots monetarios del trabajo. Sin embargo,
`getStoredIncomeValue` se reutilizaba tanto para Ingresos como para Ganancia, de
modo que Inicio, reportes, Ahorro y Meta incorporaban los Adicionales dentro del
beneficio. El campo opcional `totalIncome` tambien conservaba una definicion
ambigua y no era una fuente consistente.

## Alternativas

- Excluir los Adicionales de todos los agregados: descartado, porque el dinero
  recibido si forma parte de Ingresos y del balance general.
- Incluirlos en Ingresos y en Ganancia: descartado por autorizacion explicita;
  un Adicional no representa ganancia del servicio o jornada.
- Mantener agregadores distintos para Ingresos y Ganancia: aceptado.

## Decision

Sean `P` el principal realizado ya convertido, `A` los Adicionales convertidos,
`E` los gastos y `J` el impacto de ajustes:

```text
Ingresos = P + A
Ganancia real = P
Ganancia neta = P - E
Balance general = P + A - E + J
```

`getStoredIncomeValue` es la lectura de Ingresos (`P + A`) y
`getStoredIncomePrincipalValue` es la lectura de Ganancia (`P`). Por tanto:

- reportes, exportaciones, objetivos de Ingresos, cortes, consultas de
  transacciones y tarjetas rotuladas como Ingresos incluyen Adicionales;
- Ganancia, Ganancia neta, Ahorro y el resultado/progreso de Meta excluyen
  Adicionales;
- un balance neto de movimientos o de corte incluye Adicionales porque expresa
  saldo, no beneficio;
- los ajustes permanecen separados y solo afectan las formulas que ya los
  incorporan expresamente.

Si `realGain` es cero, el Adicional se conserva en su moneda original o base. Se
convierte a la moneda secundaria solo cuando existe un snapshot explicito de la
tasa; si no hay evidencia suficiente para convertirlo, la lectura falla cerrada
con cero para esa moneda en lugar de inventar una equivalencia.

`totalIncome` queda como campo legado opcional y no autoritativo. Las lecturas
derivan el principal de los snapshots vigentes y suman `additionalsTotal` donde
corresponde; las nuevas altas dejan de persistir `totalIncome`.

Esta decision sustituye la inclusion de Adicionales en el resultado de Meta de
ADR-032 y la propagacion a Ganancia descrita anteriormente por D-012. Conserva
vigentes el resto de ambas decisiones.

## Consecuencias

- No cambia el esquema Dexie y no se reescribe ningun ingreso ni balance
  historico.
- El registro individual sigue mostrando principal y Adicionales por separado.
- Inicio puede mostrar una tarjeta de Adicionales como desglose; no debe
  restarlos de la tarjeta Ingresos ni sumarlos a Ganancia.
- Financial Engine mantiene paridad porque delega en `buildBalanceReport`.
- Los consumidores deben elegir explicitamente entre total de Ingresos y
  principal de Ganancia; una sola suma no puede representar ambos conceptos.

## Evidencia

El caso de contrato es principal 50 + Adicionales 20 - gastos 10:

```text
Ingresos = 70
Ganancia real = 50
Ganancia neta / Meta / Ahorro = 40
Balance general = 60
```

Las pruebas focales cubren agregadores, reporte de balance, Meta, objetivos,
reportes/exportaciones de Ingresos, herramienta de transacciones y el caso
`realGain = 0`.
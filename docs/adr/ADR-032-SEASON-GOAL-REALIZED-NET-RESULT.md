# ADR-032 - Season Goal Uses Realized Net Result

Estado: Accepted  
Version: 1.0  
Fecha: 2026-08-27  
Autorización: explícita del propietario para PB-META-001 a PB-META-006

## Problema

Agenda, alta manual, Inicio, Movimientos, Temporadas y Reportes no presentaban o
agregaban siempre el mismo valor financiero persistido. Movimientos mostraba el
importe bruto de un servicio aunque Inicio agregara su neto, y la Meta de
temporada contabilizaba ingresos sin descontar egresos. Además, el progreso
negativo se normalizaba a cero.

## Decisión

Para `service_duration`, el porcentaje de temporada expresa la participación que
corresponde a la profesional y se aplica exactamente una vez:

```text
realGain = totalAmount * percentage / 100
```

Por tanto, un importe bruto de 100 al 30 % produce un neto de 30. Un porcentaje
de 0 % produce 0 y la opción "No aplica porcentaje" persiste 100 %. El método
`hourly_workday` conserva su regla independiente y no aplica este porcentaje.

El resultado realizado de una temporada se deriva como:

```text
resultado = ingresos netos realizados - egresos realizados
progreso = resultado / meta económica * 100
```

Los Adicionales forman parte únicamente del agregado de ingresos mediante el
valor almacenado. Los ajustes de ingreso y egreso permanecen separados y no
forman parte del resultado de Meta. El progreso matemático puede ser negativo o
superior al 100 %; sólo la barra visual se limita a 0–100 %.

## Consecuencias

- Agenda y alta manual de `service_duration` usan el mismo Strategy de cálculo.
- Inicio, Movimientos, Temporadas y Reportes consumen snapshots monetarios
  persistidos y no recalculan tasas históricas.
- Un movimiento individual presenta su neto principal; los Adicionales se suman
  sólo en agregados, conforme al contrato existente.
- Editar o eliminar un ingreso o egreso cambia el derivado de Meta sin persistir
  un acumulado paralelo.
- El aislamiento por modo y temporada es fail-closed. Los registros históricos
  que sólo usan `seasonPeriodId` siguen siendo válidos; si ambos identificadores
  existen y se contradicen, el registro se excluye del cálculo.
- No hay cambio de esquema Dexie, migración ni reescritura histórica.

## Fuera de alcance

No se implementan ritmo de Meta, importe necesario por día, proyección de cierre
ni incorporación de Agenda prevista. Estas ideas permanecen exclusivamente como
`PB-META-FUTURE-001` a `PB-META-FUTURE-004` en el informe de la corrección.

## Evidencia

La implementación, matriz automatizada, APK y validación física pendiente se
documentan en
[`SEASON_GOAL_FINANCIAL_CORRECTION_2026.md`](../product/SEASON_GOAL_FINANCIAL_CORRECTION_2026.md).

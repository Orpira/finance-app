# PB-GEO-002 — contrato público de dominio y persistencia (Etapa 1)

Estado: implementación de Etapa 1. La UI y la finalización atómica de citas pertenecen a etapas posteriores.

## Persistencia

Dexie v38 añade `seasonStays` y `seasonRevisions`. La migración conserva todos los registros y temporadas, no crea estancias históricas inferidas y añade una revisión `migration_baseline` por temporada preexistente. `services`, `expenses` y `appointments` admiten `seasonStayId` y `travelDestination`; las citas admiten además `completedIncomeId` para la idempotencia futura.

Las fechas previstas son fechas civiles `YYYY-MM-DD`. Los tiempos reales y de auditoría son instantes ISO. Los intervalos reales de estancia son semiabiertos `[actualStartAt, actualEndAt)`, por lo que una estancia puede terminar exactamente cuando empieza la siguiente.

## Tipos consumibles por la UI

- `SeasonStay`, `SeasonStayStatus` y `SelectableSeasonStay`: `src/types/seasonStay.ts`.
- `SeasonRevision` y sus variantes discriminadas: `src/types/seasonRevision.ts`.
- `TravelDestination`: `src/types/travelDestination.ts`. Es un destino puntual confirmado manualmente y nunca implica crear o activar una estancia.
- Los modelos `ServiceIncome`, `Expense` y `Appointment` contienen `seasonStayId?` y `travelDestination?`.

## Servicios públicos

`src/services/seasonStayService.ts` exporta:

- `createPlannedSeasonStay(input)`
- `switchActiveSeasonStay(input)`
- `completeSeasonStay(id, effectiveAt, timeZone)`
- `correctSeasonStay(input)`
- `cancelPlannedSeasonStay(id, reason, options)`
- `reorderSeasonStays(earningPeriodId, orderedStayIds)`
- `listSeasonStays`, `getSeasonStayById`, `getActiveSeasonStay`
- `listSelectableSeasonStays(input)`

`src/services/seasonRevisionService.ts` exporta:

- `reviseSeasonPlannedEnd(input)`
- `reviseSeasonEconomicGoal(input)`
- `listSeasonRevisions(earningPeriodId)`
- `getSeasonGoalHistory(earningPeriodId)`
- `getSeasonPlannedEndHistory(earningPeriodId)`

`createEarningPeriod` acepta una `firstStay` opcional. Las revisiones iniciales de fecha prevista y objetivo, la primera estancia y la temporada se escriben atómicamente. `updateActiveEarningPeriod` rechaza cambios directos de país, moneda, fecha prevista y objetivo; los dos últimos deben pasar por los servicios de revisión.

El cierre de temporada completa la estancia activa y cancela los planes aún no iniciados con `cancellationReasonCode: 'season_closed'` dentro de una transacción. Las referencias históricas de citas a esos planes se conservan. Una cancelación solicitada por la usuaria solo admite estancias no iniciadas, exige motivo y requiere desvincular explícitamente las citas modificables; nunca desvincula movimientos financieros.

## Reglas para integración de UI

- La primera estancia es opcional y puede haber huecos entre estancias.
- Solo puede existir una estancia activa por temporada y no puede haber solapamientos reales.
- Una estancia conserva el país de su temporada. Un destino internacional puntual se representa con `travelDestination.countryCode` y no cambia país ni moneda base.
- Las ciudades repetidas son estancias distintas; `listSelectableSeasonStays` entrega número de visita y etiqueta.
- La selección manual y la normalización de ciudades funcionan sin red mediante `normalizeCityName`.
- Una cita puede seleccionar una estancia `planned`; ingresos y egresos solo pueden seleccionar estancias iniciadas. La activación o desvinculación previa a completar la cita se implementará junto con la transacción unificada de la etapa correspondiente.
- La ciudad/país guardados en cada registro siguen siendo la instantánea histórica. Editar una estancia no los reescribe automáticamente.

## Backup

El formato lógico pasa a versión 3 e incluye ambas colecciones nuevas. Los backups anteriores siguen admitidos con colecciones vacías. Antes de borrar datos locales, la restauración valida referencias, país, posiciones, secuencias, estados, solapamientos y asociaciones registro-temporada-estancia; una estancia huérfana causa rechazo fail-closed.

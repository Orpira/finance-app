# PB-GEO-002 — contrato público de dominio y persistencia (Etapa 1)

Estado: dominio/persistencia de Etapa 1, integración de registros de Etapa 2 y finalización atómica de citas de Etapa 3. La UI pertenece a una etapa posterior.

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

## Contrato de registros — Etapa 2

Los DTO públicos `CreateServiceIncomeInput`, `CreateExpenseInput` y `CreateAppointmentInput` aceptan:

```ts
seasonStayId?: number | null
travelDestination?: TravelDestination | null
```

Los DTO de actualización añaden además:

```ts
syncLocationFromStay?: boolean
```

La semántica de actualización es estable para los tres servicios:

- campo omitido o `undefined`: conserva el valor persistido;
- `null`: elimina la asociación o el destino;
- valor: valida y establece el valor;
- `syncLocationFromStay: true`: sustituye explícitamente la instantánea `city`/`country` por la estancia validada.

En una creación con estancia, `city` y `country` siempre se copian de ella. En una edición se conserva la instantánea histórica aunque cambie la asociación, salvo edición manual explícita de esos campos o `syncLocationFromStay`. Nunca se obtiene una estancia desde GPS ni desde `settings.city`.

`src/services/recordGeographyService.ts` centraliza las reglas y exporta:

- `resolveCreateRecordGeography(input, options)`
- `resolveUpdateRecordGeography(existing, updates, options)`
- `getRecordGeographyReadModel(record)`
- `RecordGeographyReadModel`

Ingresos y egresos solo admiten estancias `active` o `completed` y deben caer dentro de sus fechas reales. Las citas admiten además una estancia `planned` cuando su fecha cae dentro del intervalo previsto. Las estancias canceladas, las pertenecientes a otra temporada y los intervalos incompatibles se rechazan dentro de la misma transacción que persistiría el registro.

Las citas legacy sin temporada y todos los registros sin estancia continúan siendo legibles y editables conforme a las reglas anteriores. `completedIncomeId` queda reservado al servicio de finalización atómica de la etapa siguiente y no forma parte de los DTO públicos de creación o edición de citas.

## Backup

El formato lógico pasa a versión 3 e incluye ambas colecciones nuevas. Los backups anteriores siguen admitidos con colecciones vacías. Antes de borrar datos locales, la restauración valida referencias, país, posiciones, secuencias, estados, solapamientos y asociaciones registro-temporada-estancia; una estancia huérfana causa rechazo fail-closed.

## Finalización atómica de citas — Etapa 3

`src/services/appointmentCompletionService.ts` exporta:

- `completeAppointmentAsIncome(appointmentId, settings, now?, options?)`
- `CompleteAppointmentOptions`
- `CompleteAppointmentResult`
- `AppointmentCompletionError` y `AppointmentCompletionErrorCode`

El resultado discriminado es `completed`, con la cita y el ingreso persistidos, o `already_completed`, que es el resultado idempotente de un reintento. Toda finalización nueva escribe cita, ingreso, evento `income.created` y `completedIncomeId` en una única transacción Dexie sobre `appointments`, `services`, `earningPeriods`, `seasonStays`, `automationOutbox` y `settings`. Un fallo en cualquiera de las escrituras revierte el conjunto completo.

Las conversiones asíncronas se preparan antes del commit. Dentro de la transacción se releen la cita, temporada, estancia y configuración, se compara un fingerprint de las precondiciones financieras y geográficas, se recalcula el importe mediante el calculador canónico y se revalida la geografía. Un cambio concurrente produce `APPOINTMENT_PRECONDITION_CHANGED` o `APPOINTMENT_SEASON_INVALID`; nunca se aplican cálculos preparados sobre datos distintos. La cotización válida se persiste en el ingreso aunque falle su caché auxiliar.

Una estancia `planned` produce `STAY_NOT_STARTED`. La UI puede activar la estancia y reintentar, o solicitar explícitamente la desvinculación con:

```ts
{ plannedStayResolution: { action: 'detach', reason: string } }
```

El motivo no vacío es obligatorio. La desvinculación conserva `city`, `country` y `travelDestination` de la cita, y registra `seasonStayDetachedFromId`, `seasonStayDetachedAt` y `seasonStayDetachmentReason`. Estancias canceladas o geográficamente incompatibles continúan rechazadas. Las citas legacy sin temporada explícita usan la temporada activa, manteniendo su instantánea de ubicación; `settings.city` solo cubre la ausencia total de instantánea y nunca la reemplaza.

`claimAppointmentCompletion` y completar mediante `markAppointmentCompleted` quedan bloqueados: los consumidores deben usar `completeAppointmentAsIncome`. Reabrir una cita que ya tiene `completedIncomeId` también se rechaza para preservar la integridad financiera. El despacho del outbox y la cancelación de recordatorios ocurren exclusivamente después del commit; un fallo de recordatorios se devuelve como `REMINDER_CANCELLATION_FAILED` sin revertir el ingreso ya confirmado.

## Interfaz — Etapa 4

Componentes en `src/components/seasons/geo/`: `SeasonItinerary`, `SeasonRevisionPanel`, `RecordGeographyFields`, `RecordGeographySummary`, `useAppointmentCompletion` (+ `StayNotStartedDialog`) y helpers puros de presentación y payload. La UI solo consume las APIs listadas arriba; la compatibilidad de una estancia con la fecha de un registro se consulta a `resolveCreateRecordGeography`, sin duplicar reglas.

## Integridad dominio–UI — Etapa 5A

- `listSelectableSeasonStays` acepta `temporalValue?` y devuelve cada `stay` junto con `selectable` y `disabledReason`. La UI consume este read model; la regla temporal pura compartida es `getStayRecordDisabledReason`.
- `createEarningPeriod.firstStay` acepta `actualStartAt` y `timeZone`. Si se informan, temporada, revisiones, configuración y primera estancia activa nacen en la misma transacción.
- `closeActiveEarningPeriodAndCreate(input, endDate?)` cierra la temporada vigente y crea la siguiente con rollback conjunto. Abrir el formulario de nueva temporada ya no cierra anticipadamente la anterior.
- `updateActiveEarningPeriod.city` aplica semántica estable: `undefined` conserva, `null` elimina y un texto establece la instantánea legacy.
- Una estancia real sin `actualEndAt` se considera abierta y se solapa con cualquier estancia confirmada posterior. La transición de ciudad en el mismo instante sigue admitida porque el intervalo anterior termina exactamente cuando empieza el siguiente.
- Las fechas previstas continúan siendo fechas civiles sin conversión de zona. En un cierre interactivo de hoy, la estancia activa guarda el instante real de cierre; la fecha civil de la temporada se conserva separadamente.
- `closedLocationSeasons` continúa aplicándose solo a registros legacy sin `seasonStayId`; nunca bloquea un registro asociado explícitamente a una estancia.

## Interfaz — Etapa 5B

- El selector de estancia nunca asocia una estancia sin acción explícita: «Sin estancia» es el valor inicial y la estancia actual compatible se ofrece como sugerencia identificable («Usar estancia actual: ciudad, país · visita»).
- En edición, ingresos, egresos y citas envían exactamente la instantánea `city`/`country` guardada; `settings` solo precarga la ubicación de registros nuevos sin estancia. La sincronización con la estancia sigue siendo explícita (`syncLocationFromStay`).
- `describeSeasonLocation` presenta la ubicación de una temporada desde el itinerario; `EarningPeriod.city` solo se muestra como «Ciudad histórica» cuando no hay estancias.

Hallazgos fuera del alcance de la interfaz, pendientes de decisión:

- `elapsedPercentage` (`src/notifications/rules/seasonGoalShared.ts`) concatena `T00:00:00` a `startDate`/`plannedEndDate`, que ya son ISO completos; el resultado es `NaN` y la regla de riesgo de meta no puede evaluar el tiempo transcurrido.
- Ingresos y egresos pueden guardarse antes de que termine la conversión de moneda asíncrona del formulario; en ese caso se persisten `eurValue`/`baseCurrencyValue` a 0 y el resultado de temporada omite el importe. Reproducido en navegador con IndexedDB real; existía antes de PB-GEO-002.


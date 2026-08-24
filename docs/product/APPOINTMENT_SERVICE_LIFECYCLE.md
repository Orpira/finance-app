# Ciclo idempotente de servicios desde Agenda

## Estado

**IMPLEMENTADO**, pendiente de validación funcional E2E en navegador o
dispositivo real.

Este documento describe el comportamiento observado en el working tree
posterior a `b300f89`. No constituye todavía una certificación UI.

## Problema corregido

El flujo anterior enviaba desde la UI un objeto `Appointment` capturado durante
el render. `completeAppointmentAsIncome` comprobaba `completed` sobre ese objeto
potencialmente obsoleto, creaba primero el ingreso y actualizaba después la cita.
Dos pulsaciones rápidas podían entrar con `completed: false` y producir dos
ingresos antes de que `reloadAppointments()` refrescara la pantalla.

Además, Agenda permitía iniciar una cita sin validar su fecha y hora programadas.
La pantalla y `ServiceTimeAlert` mantenían efectos separados de inicio
automático y mostraban cronómetros ascendentes independientes.

## Contrato implementado

El ciclo vigente es:

```text
PROGRAMADA
→ DISPONIBLE (now >= dateTime; estado derivado)
→ EN SERVICIO (pulsación explícita)
→ REALIZADA (pulsación explícita)
```

No se añadió un campo persistente de estado. La fase se deriva de `dateTime`,
`timerStartedAt`, `timerStoppedAt`, `actualDuration` y `completed`.

### Disponibilidad del horario

`createAppointment` trata cada cita como el intervalo semiabierto
`[dateTime, dateTime + duration)`. Dentro de la misma transacción Dexie que
inserta la cita, relee las existentes y rechaza cualquier intersección, incluso
si dos creaciones concurrentes solicitan el mismo intervalo. Dos citas sí
pueden ser consecutivas cuando la segunda comienza exactamente al finalizar la
primera.

`updateAppointment` aplica la misma regla cuando cambia `dateTime` o `duration`
y excluye la propia cita de la comparación. Las citas legacy ya solapadas
pueden seguir editando notas, importe u otros campos no temporales, pero un
cambio de horario debe dejar un intervalo libre. El formulario presenta el
error específico `El horario está ocupado por otra cita` sin guardar cambios.

### Inicio

`startAppointmentService(appointmentId, now)`:

- relee la cita desde IndexedDB dentro de una transacción Dexie `rw`;
- rechaza el inicio cuando `now < appointment.dateTime`, comparando fecha y
  hora completas;
- fija `timerMode: 'manual'` y `timerStartedAt` una sola vez;
- no reinicia una cita que ya tiene `timerStartedAt`;
- no depende del estado React ni de un intervalo para conservar el inicio.

La UI deshabilita `Iniciar servicio` antes de la hora programada, pero esta es
solo una ayuda visual: la protección autoritativa está en el servicio de
dominio.

### Finalización

`completeAppointmentAsIncome(appointmentId, settings, now)` ya no recibe el
objeto capturado por la UI. Relee la cita mediante `getAppointmentById` y solo
continúa si existe un servicio activo y la cita no está completada.

`claimAppointmentCompletion` reclama la finalización en una transacción Dexie
`rw`. La primera llamada fija `completed`, `timerStoppedAt` y `actualDuration`;
las llamadas posteriores reciben `null` y no invocan `createServiceIncome`.
La garantía implementada es **a lo sumo un ingreso por cita** frente a
pulsaciones concurrentes.

`actualDuration` se calcula una sola vez con redondeo hacia arriba:

```text
ceil((timerStoppedAt - timerStartedAt) / 60 segundos)
```

El valor persistido no depende de que siga corriendo un intervalo.

El ingreso resultante conserva `timerStartedAt`, `timerStoppedAt` y
`actualDuration` como trazabilidad del tiempo medido en Agenda, pero se crea con
`status: 'FINALIZADO'` y `timerUsed: false`. Por tanto, `createServiceIncome` no
inicia un segundo cronómetro ni incorpora este registro a los servicios activos
de `ServiceCompletionAlert`.

## Protección en UI

`AgendaPage` mantiene un `Set<number>` en `useRef` mediante `runExclusive`.
Mientras una operación está activa, ignora nuevas pulsaciones para el mismo
`appointmentId` y deshabilita el botón correspondiente. Esta barrera reduce
llamadas redundantes, pero la idempotencia autoritativa permanece en el dominio.

Las tarjetas muestran estados derivados:

- `Disponible a las HH:mm` antes de la hora;
- `Inicio retrasado` cuando ya pasó la hora y no se inició;
- `Servicio en curso` con la hora real de inicio;
- `Servicio realizado` como acción de finalización.

Las citas completadas dejan de pertenecer a `selectedAppointments`, por lo que
la rama visual con inicio, fin y duración de una cita ya realizada no aparece
en el listado activo actual.

## Cronómetros y alarmas

Se eliminaron de Agenda el chip `Clock3`, el contador `HH:mm:ss`, sus helpers y
el efecto `startDueTimers`. El intervalo de Agenda pasó de 1 segundo a 20
segundos y solo reevalúa si una cita ya está disponible.

En `ServiceTimeAlert` se eliminó el bloque visual llamado `Cronómetro` y su
efecto duplicado de auto-inicio. El componente conserva el tick necesario para
detectar que se alcanzó la duración prevista, reproducir la alarma y ofrecer
`Continuar` o `Finalizar servicio`; también conserva la duración real expresada
en minutos.

Los recordatorios de `AppointmentReminderAlert` y `reminderService` permanecen
separados del ciclo del servicio. Cada cita nueva incluye una alarma editable 5
minutos antes y permite hasta dos; ambas se disparan antes de la hora programada.

No se modificaron funcionalmente `ServiceCompletionAlert` ni
`serviceTimerService`, que operan sobre ingresos
  por servicio almacenados en `db.services`, no sobre citas.

## Cobertura automatizada

`src/services/appointmentService.test.ts` contiene 14 pruebas totales. Dentro
del bloque nuevo se comprueban:

- rechazo del mismo inicio y de cruces parciales por ambos extremos;
- aceptación de citas exactamente consecutivas;
- rechazo de edición hacia un intervalo ocupado y exclusión de la propia cita;
- edición no temporal de datos legacy ya solapados;
- dos creaciones concurrentes con una sola inserción ganadora;
- rechazo antes de la fecha/hora;
- comparación de fecha y hora, no solo hora;
- inicio permitido en el instante exacto;
- cinco llamadas concurrentes con un único `timerStartedAt`;
- finalización sin servicio activo como no-op;
- una sola reclamación ganadora entre cinco llamadas;
- repetición posterior sin cambios.

`src/services/appointmentCompletionService.test.ts` contiene 6 pruebas:

- persistencia obligatoria como `service_duration`;
- ingreso finalizado con trazabilidad temporal, pero sin un segundo cronómetro;
- ausencia de ingreso sin `timerStartedAt`;
- ausencia de ingreso para una cita completada;
- ausencia de ingreso si otra llamada ganó la reclamación;
- cinco llamadas concurrentes con una sola invocación de
  `createServiceIncome`.

La serialización concurrente de `appointmentService.test.ts` se reproduce con
una cola en el mock de `db.transaction`. No sustituye una prueba en IndexedDB
real ni una validación de doble pulsación en navegador.

La ejecución reportada para el cambio fue:

```text
npm run lint       PASS
npm run typecheck  PASS
npm run build      PASS
npm test           200 archivos, 2249 PASS, 0 FAIL, 1 TODO preexistente
```

La reverificación focal documental ejecutó ambas suites con 20/20 pruebas
aprobadas: 14 de `appointmentService` y 6 de
`appointmentCompletionService`.

`src/utils/appointmentReminders.test.ts` añade 3 pruebas para el recordatorio
inicial de 5 minutos y para la semántica siempre previa de las dos alarmas
configurables.

## Pendientes y riesgo residual

- Falta ejecutar el flujo real en navegador o dispositivo: crear una cita,
  comprobar el rechazo de solapamientos y la aceptación de citas consecutivas,
  comprobar el bloqueo antes de hora, iniciar, pulsar varias veces, finalizar,
  verificar un solo ingreso y recargar la PWA.
- El gate de licencia impidió esa validación en el entorno donde se implementó;
  no se modificó seguridad para sortearlo.
- `claimAppointmentCompletion` persiste `completed: true` antes de ejecutar
  `createServiceIncome`. Esto evita duplicados, pero ambas escrituras no forman
  una única transacción. Si la creación del ingreso falla después de reclamar
  la cita, puede quedar una cita completada sin ingreso y los reintentos serán
  no-op. No hay todavía compensación ni una prueba que cubra ese fallo.
- El auto-inicio silencioso fue eliminado: pasar a `EN SERVICIO` requiere ahora
  una pulsación explícita. Si el producto vuelve a requerir auto-inicio, deberá
  diseñarse como una transición idempotente independiente.

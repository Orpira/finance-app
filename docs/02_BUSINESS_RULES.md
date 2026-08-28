# 02 Business Rules

## Reglas financieras confirmadas

- Los ingresos y egresos no deben alterarse sin autorización explícita.
- Los balances históricos deben ser reproducibles.
- Los porcentajes de ganancia no se modifican de forma automática fuera de la configuración o del flujo previsto.
- Los ajustes deben quedar visibles como ajustes.
- Los ajustes positivos suman al balance y los negativos restan.
- La meta económica de una temporada mide el resultado realizado:
  `ganancia principal realizada - egresos realizados`. Los Adicionales y los
  ajustes no forman parte de este cálculo y permanecen separados.
- El progreso de la meta es `resultado / meta * 100`. Puede ser negativo o
  superar el 100 %; únicamente la barra visual se limita al intervalo 0–100 %.

## Modos de uso

### Modo Básico

- No usa temporadas.
- Debe seguir funcionando sin la lógica avanzada del modo Profesional.
- En la interfaz de Ingresos no ofrece Adicionales ni estados operativos del
  servicio (`Pendiente`, `En ejecución`, `Finalizado`). El usuario puede crear,
  modificar y eliminar el ingreso principal sin esos controles profesionales.

### Modo Profesional

- Usa temporadas o periodos.
- Los registros pueden quedar vinculados a temporada activa.
- Un ingreso vinculado a una temporada no puede tener una fecha anterior al
  inicio de esa temporada. La creación o edición inválida se rechaza antes de
  persistir cambios.
- Los cierres de temporada afectan mutabilidad y reportes.
- Conserva los Adicionales y los estados operativos de los ingresos de tipo
  servicio, tanto en el listado como en sus flujos de alta y edición.

## Configuración inicial y planificación

- El onboarding v2 es local, reanudable y consta de siete pasos: bienvenida,
  tipo de uso, método de cálculo profesional, primera temporada, moneda, seguridad
  y finalización. El modo Personal omite los pasos exclusivos del modo
  Profesional.
- Los usuarios con datos locales previos no son obligados a repetir el
  onboarding. El progreso se conserva en `AppSettings.onboarding` con versión,
  paso actual y estado de finalización.
- En modo Profesional, el método de cálculo del ingreso se elige de forma
  explícita. `workedTimeUnit` solo representa una unidad de captura y nunca
  decide entre `service_duration` y `hourly_workday`.
- Elegir `hourly_workday` exige un `hourlyRate` finito mayor que cero. Método y
  tarifa se validan y persisten juntos; ante una tarifa inválida, la operación
  se rechaza sin guardar una configuración parcial. Elegir `service_duration`
  no sobrescribe una tarifa previamente configurada.
- La primera temporada profesional puede incluir `plannedEndDate` y
  `economicGoal`. La fecha prevista es informativa: alcanzarla no cierra la
  temporada ni modifica movimientos. El cierre siempre requiere una acción
  explícita.
- La opción "No aplica porcentaje, usar 100 %" guarda
  `earningPercentage = 100`; no crea un valor nulo ni un estado especial.
- El porcentaje de una temporada expresa la participación que corresponde a la
  profesional. En `service_duration`, un importe bruto de 100 con 30 % produce
  un ingreso neto realizado de 30; 0 % produce 0. El importe restante de la meta
  nunca se presenta como negativo.

## Ingresos

- Se registran como servicios o variantes derivadas según utilidades de tipo.
- Pueden incluir duración, porcentaje y tipo de pago según el método de cálculo.
- Se calculan valores base, secundarios y equivalentes agregados para reportes.
- Cada ingreso de tipo servicio se calcula según un **Método de cálculo del
  ingreso** (`incomeCalculationMethod`, snapshot inmutable fijado al crear el
  ingreso): `service_duration` ("Servicio por tiempo", el flujo histórico:
  duración fija + importe tecleado + % de temporada) o `hourly_workday`
  ("Jornada por horas": tiempo trabajado manual × valor por hora). El motor
  de cálculo (`src/utils/incomeCalculation/`) sigue un patrón Strategy —
  cada método es una implementación aislada, sin condicionales por método
  fuera del despachador (`incomeCalculatorRegistry.ts`).
- `service_duration` aplica el % de la temporada activa igual que siempre
  (`realGain = totalAmount * percentage / 100`). `hourly_workday` **nunca**
  aplica ese %: el pago por hora ya es el 100% del ingreso final de la
  profesional. El cronómetro es exclusivo de `service_duration` y jamás se
  inicia para `hourly_workday`.
- Una cita profesional no inicia su servicio antes de `dateTime`. Alcanzar la
  fecha y hora solo habilita la acción: el paso a servicio en curso requiere una
  pulsación explícita y fija `timerStartedAt` una sola vez.
- Finalizar una cita requiere un servicio previamente iniciado. La reclamación
  de finalización es idempotente por `appointmentId`; pulsaciones repetidas no
  deben producir ingresos duplicados.
- Al finalizar una cita, `service_duration` usa el mismo Strategy que el alta
  manual y aplica el porcentaje de temporada una sola vez. El ingreso conserva
  sus snapshots monetarios; ningún agregado recalcula tasas históricas.
- `service_duration` recopila el tipo de pago al registrar el ingreso.
  `hourly_workday` no lo solicita en el formulario al crearse, pero se
  persiste con el valor por defecto `cash` ("Efectivo") para que listados,
  detalle y reportes por tipo de pago lo traten igual que un servicio, sin
  un caso especial de "No aplica". Al **editar** un ingreso ya guardado, el
  tipo de pago se puede modificar igual en `hourly_workday` que en
  `service_duration`; si la edición no lo vuelve a enviar, se conserva el
  valor existente sin reescribirlo.
- El flujo Pendiente/Reportado (`canMarkAsReported`,
  `src/utils/reportStatus.ts`) se comporta igual para `service_duration` y
  `hourly_workday`: cualquier ingreso profesional de tipo servicio es
  reportable, sin distinción por método de cálculo. Un usuario puede combinar
  ambos métodos en la misma temporada y ambos requieren el mismo seguimiento
  de reporte.
- La interfaz presenta este selector como **Tipo de registro**. Para
  `service_duration` usa "Servicio"; para `hourly_workday`, "Jornada" en el
  formulario y "Jornada por horas" en listados, detalle, movimientos,
  reportes y exportaciones. Esta distinción deriva de
  `incomeCalculationMethod`: el campo persistido `type` conserva su contrato y
  no se migran registros históricos. El tipo de pago de una jornada se
  presenta y agrupa en reportes igual que en un servicio (ver regla anterior).
- Un ingreso puede tener 0..N **Adicionales** (importes positivos que
  complementan el ingreso, nunca negativos, sin tope). **Nunca se suman al
  `realGain`/`totalAmount` del ingreso**: el registro del ingreso refleja
  siempre y exclusivamente el trabajo realizado (servicio o jornada), tanto
  al crearlo como después. Solo el campo `additionalsTotal` se mantiene al
  día al agregar/quitar un Adicional; el resto del registro (incluidos los
  valores convertidos a otras monedas) nunca se recalcula por esa causa. Los
  Adicionales se suman exclusivamente a métricas de **Ingresos** y balance
  general (Inicio, reportes, exportaciones y consultas), en el punto central
  `getStoredIncomeValue` (`src/utils/financeStats.ts`) — nunca dentro del
  registro individual ni de una métrica de Ganancia. Ganancia real usa solo el
  principal; Ganancia neta, Ahorro y Meta usan principal menos egresos. No son
  un movimiento financiero independiente: se eliminan en cascada si se borra
  el ingreso al que pertenecen (a diferencia de los ajustes, que bloquean ese
  borrado). Ver ADR-033.
- "Jornada por horas" tampoco captura ni persiste ningún porcentaje de
  temporada (`percentage`/`earningPercentage` quedan en `0`): ese % no aplica
  a este método bajo ninguna circunstancia.
- Cambiar el método de cálculo o el valor por hora en Configuración solo
  afecta a los ingresos creados después del cambio; nunca recalcula ni
  altera ingresos históricos.

## Consulta de divisas

- `Más → Consulta de divisas` ofrece una herramienta informativa que convierte
  un importe local desde una moneda base hacia cuatro monedas deduplicadas. El importe escrito no se
  persiste ni se envía a la API y el resultado nunca modifica ingresos,
  egresos, balances, tasas históricas ni configuración.
- En modo de tasa automático, la consulta usa una cotización API ya guardada
  para el mismo par y fecha antes de solicitar otra. En modo manual no hace una
  llamada automática; el botón de actualización constituye la acción explícita
  para consultar Frankfurter.
- Sin red, la consulta puede usar la última tasa guardada o una referencia
  local, siempre identificando la fuente. Si no existe una tasa válida para el
  par, muestra "No disponible" y nunca inventa ni degrada silenciosamente un
  valor.

## Egresos

- Se clasifican por categoría.
- Pueden relacionarse con un ingreso.
- Admiten tipo gasto o ajuste.
- Los gastos realizados reducen el resultado de la meta de su temporada. Editar
  o eliminar un gasto actualiza el derivado; no se persiste un acumulado aparte.

## Agenda

- Una cita puede convertirse en ingreso completado.
- La duración real puede venir del temporizador o del dato manual.
- Las alarmas y recordatorios son parte del módulo, no de la contabilidad principal.
- Una cita nueva parte con una alarma editable 5 minutos antes y admite como
  máximo dos alarmas configurables, ambas anteriores a la hora de inicio.
- Las citas no pueden compartir ni cruzar tiempo planificado. La disponibilidad
  considera desde `dateTime` hasta `dateTime + duration`; una cita consecutiva
  puede comenzar exactamente cuando termina la anterior.
- La alarma de duración prevista solo aplica después de iniciar el servicio y
  se dispara al alcanzar la duración programada.

## Reportes

- Deben contemplar ambos modos de uso.
- El estado de reporte forma parte del dato persistido.
- Exportaciones disponibles: PDF, CSV y tablas formateadas; XLSX aparece documentado a nivel de servicio y debe validarse operativamente en cada release.

## Autoridad de cálculo durante AI Foundation

- Las reglas legacy vigentes siguen siendo la fuente oficial por defecto y el Financial Engine debe reutilizarlas sin reinterpretarlas.
- Reports permanece en shadow mode: una divergencia se observa, pero nunca sustituye el resultado legacy.
- Solo el resumen de balance de Home puede usar el resultado del Financial Engine, y únicamente cuando el build contiene el texto exacto `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- Ausencia, `false`, diferencias de mayúsculas, espacios u otros valores conservan legacy. No existe override programático del flag.
- Desactivar el piloto requiere rebuild y redeploy. No hay migración de datos ni limpieza asociada al rollback.
- Financial Engine no es todavía fuente global; Financial Snapshot, Rule Registry, Knowledge Layer e Insight Engine no existen como componentes implementados.

## Licencias y dispositivo

- La licencia está vinculada al dispositivo.
- La app valida formato, firma, dispositivo y expiración antes de autorizar automatizaciones.
- La identidad de dispositivo no debe clonarse mediante backup ordinario.

## Automatización y WhatsApp

- El registro local se confirma primero; la automatización sale por outbox.
- El canal de comunicación debe resolverse por deviceCode -> userCode -> communication_channels.
- No debe usarse un canal global por recencia para notificaciones.

## Pendiente de validar

- Regla final de negocio para fallback cuando un usuario tenga más de un canal WhatsApp activo por combinación de userCode y deviceCode.
- Cobertura total de service.completed en documentación funcional pública.

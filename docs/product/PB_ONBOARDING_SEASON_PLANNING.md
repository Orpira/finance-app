# PB-001 a PB-003 - Onboarding y planificación de temporadas

**Estado:** Implementado
**Fecha de cierre técnico:** 2026-08-04
**Commit base auditado:** `470f64b493aa7eab5b4b85d6b523a0ae79eb4e66`

## Alcance

Esta entrega incorpora la configuración inicial guiada, la planificación de la
primera temporada profesional y la presentación del progreso hacia una meta
económica. No cambia fórmulas financieras, balances históricos ni el cierre de
temporadas.

## Configuración inicial

El onboarding v2 tiene siete pasos:

1. bienvenida;
2. tipo de uso: Personal o Profesional;
3. método de cálculo del ingreso profesional;
4. primera temporada profesional;
5. moneda principal;
6. PIN y preferencia de copia de seguridad;
7. finalización.

El modo Personal omite los pasos exclusivos del modo Profesional. Los usuarios
que ya tienen datos locales no son obligados a repetir el onboarding. El estado
se conserva en `AppSettings.onboarding`, con versión y paso actual, para poder
reanudar una configuración interrumpida.

La selección profesional ofrece los métodos canónicos `Servicio por tiempo` y
`Jornada por horas`, y persiste `incomeCalculationMethod`. Ingresos consume ese
valor directamente para mostrar el formulario correspondiente. La unidad
`workedTimeUnit` no decide el método de cálculo ni se usa para convertir por sí
sola un servicio en una jornada por horas. Cuando se elige `Jornada por horas`,
el paso exige un `hourlyRate` finito mayor que cero y lo guarda en la misma
actualización. `Servicio por tiempo` no modifica una tarifa ya configurada. El
importe se interpreta en la moneda principal elegida posteriormente en el
asistente.

## Primera temporada profesional

El onboarding solicita:

- nombre;
- fecha de inicio;
- finalización prevista;
- meta económica;
- porcentaje de ganancia.

La opción **No aplica porcentaje, usar 100 %** persiste el valor `100`; no crea
un estado ambiguo ni omite el porcentaje. La temporada se crea al confirmar la
moneda principal y se rechaza la operación si ya existe una temporada activa
diferente.

`plannedEndDate` es una fecha informativa. Alcanzarla no cierra la temporada ni
modifica sus movimientos; el cierre continúa siendo una acción explícita del
usuario. `economicGoal` permite presentar el importe alcanzado, el restante y
el porcentaje de progreso, incluido un resultado superior al 100 % sin producir
un restante negativo.

## Persistencia local

Dexie avanza a la versión 31. La migración:

- añade el índice `plannedEndDate` a `earningPeriods`;
- conserva todos los movimientos y temporadas válidos;
- elimina solamente valores opcionales inválidos de `economicGoal` o
  `plannedEndDate`;
- no recalcula importes ni altera balances históricos.

La migración se implementa en `src/database/migrations/v31SeasonPlanning.ts` y
se valida sobre IndexedDB real, no solo mediante mocks.

## Presentación

La planificación y el progreso de la temporada se muestran en Inicio,
Temporadas y Reportes. La fecha prevista siempre se identifica como informativa
y no como fecha de cierre automático.

La corrección posterior del wizard reemplaza la selección aislada `Por minutos`
/ `Por horas`, que solo cambiaba la presentación de la duración, por la selección
del método financiero real. `Servicio por tiempo` mantiene el selector de
duración; `Jornada por horas` muestra tiempo trabajado y total calculado. Agenda
conserva su flujo de duración existente.

## Garantías

- local-first y disponible sin red;
- modo Personal sin dependencia de temporadas;
- método financiero elegido de forma explícita en modo Profesional;
- minutos como almacenamiento canónico de duración;
- ninguna temporada se cierra automáticamente;
- ninguna fórmula financiera fue modificada.

## TDD y validación

La entrega se desarrolló con pruebas rojas antes de la implementación. La
cobertura focal incluye:

- `test/onboarding.test.ts`;
- `test/onboardingIncomeMethodStep.test.tsx`;
- `test/seasonPlanning.test.ts`;
- `test/serviceDuration.test.ts`;
- `test/serviceDurationSelect.test.tsx`;
- `test/indexeddb/browser.ts`.

Validación final de la entrega:

- ESLint correcto;
- build TypeScript/Vite correcto;
- 183 archivos de prueba y 2118 pruebas aprobadas, con 1 `todo` preexistente;
- migración Dexie v31 aprobada en el harness de IndexedDB real.

## Alcance relacionado pendiente

[PB-004](PB_004_CONVERSATION_AUDIT.md) es una auditoría de la conversación
visible. Sus hallazgos no se consideran corregidos por esta entrega.

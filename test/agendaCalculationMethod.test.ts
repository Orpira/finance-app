import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { getIncomeDurationDisplay } from '../src/utils/serviceDuration'

function readSource(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

// Corrección de defecto funcional: Agenda ignoraba el método de cálculo
// profesional vigente y siempre exigía "Duración (Minutos)"/"Tipo de pago"
// del flujo de Servicio por tiempo, incluso con "Jornada por horas"
// configurada (docs/architecture/14_DECISIONS.md D-011). Estos tests
// verifican que Agenda reutiliza las reglas canónicas de ingresos
// (src/catalogs/incomeCalculationMethods.ts, src/utils/serviceDuration.ts) en
// vez de duplicar su propia interpretación del método.

describe('getIncomeDurationDisplay reutilizado por Agenda (AG-CALC-001/003)', () => {
  it('una cita de "Jornada por horas" muestra el tiempo trabajado en horas, no minutos', () => {
    expect(
      getIncomeDurationDisplay({
        duration: 150,
        incomeCalculationMethod: 'hourly_workday',
        workedTime: 2.5,
        workedTimeUnit: 'hours',
      }),
    ).toBe('2.5 horas')
  })

  it('una cita de "Servicio por tiempo" conserva el formato existente en minutos (regresión)', () => {
    expect(
      getIncomeDurationDisplay({ duration: 60, durationLabel: '60' }),
    ).toBe('60 minutos')
  })
})

describe('AppointmentFormPage.tsx — fuente única de verdad del método (regresión de código fuente)', () => {
  const source = readSource('src/pages/Agenda/AppointmentFormPage.tsx')

  it('reutiliza shouldCollectPaymentTypeAtRegistration en vez de mostrar "Tipo de pago" incondicionalmente', () => {
    expect(source).toContain('shouldCollectPaymentTypeAtRegistration')
    expect(source).toContain('collectsPaymentType &&')
  })

  it('nunca reinterpreta una cita ya agendada: conserva el snapshot al editar (AG-CALC-006/008)', () => {
    expect(source).toContain(
      "editingAppointment.incomeCalculationMethod ?? 'service_duration'",
    )
  })

  it('la duración en horas admite incrementos de 0,25 (AG-CALC-001)', () => {
    expect(source).toContain('step="0.25"')
  })
})

describe('appointmentService.ts — inmutabilidad del método al editar (AG-CALC-008)', () => {
  it('updateAppointment descarta incomeCalculationMethod de las actualizaciones', () => {
    const source = readSource('src/services/appointmentService.ts')

    expect(source).toContain("delete safeUpdates.incomeCalculationMethod")
  })
})

describe('appointmentCompletionService.ts — generación de ingreso desde cita (AG-CALC-004/005)', () => {
  it('reutiliza runIncomeCalculation en vez de recalcular el importe dentro de Agenda', () => {
    const source = readSource('src/services/appointmentCompletionService.ts')

    expect(source).toContain("runIncomeCalculation('service_duration'")
    expect(source).toContain("runIncomeCalculation('hourly_workday'")
  })
})

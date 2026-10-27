import { describe, expect, it } from 'vitest'

import { AppointmentCompletionError } from '../../../services/appointmentCompletionService'
import { SeasonGeoDomainError } from '../../../utils/seasonGeoValidation'
import { RETRYABLE_COMPLETION_CODES, describeSeasonGeoError, getErrorCode } from './seasonGeoMessages'

describe('seasonGeoMessages', () => {
  it('traduce por código, no por el texto del servicio', () => {
    const error = new SeasonGeoDomainError('RECORD_OUTSIDE_STAY_INTERVAL', 'texto técnico')
    expect(describeSeasonGeoError(error)).toMatch(/fuera de las fechas de la estancia/)
  })

  it('traduce errores de finalización y marca como reintentable el contexto obsoleto', () => {
    const error = new AppointmentCompletionError('APPOINTMENT_PRECONDITION_CHANGED', 'x')
    expect(getErrorCode(error)).toBe('APPOINTMENT_PRECONDITION_CHANGED')
    expect(RETRYABLE_COMPLETION_CODES.has('APPOINTMENT_PRECONDITION_CHANGED')).toBe(true)
    expect(describeSeasonGeoError(error)).toMatch(/No se guardó nada/)
  })

  it('usa el mensaje del error o el texto alternativo cuando no hay código', () => {
    expect(describeSeasonGeoError(new Error('Fallo concreto'))).toBe('Fallo concreto')
    expect(describeSeasonGeoError('raro', 'Alternativo')).toBe('Alternativo')
  })

  it('traduce FINANCIAL_CONVERSION_INCOMPLETE sin mostrar el código', () => {
    const message = describeSeasonGeoError(new Error('FINANCIAL_CONVERSION_INCOMPLETE'))
    expect(message).toMatch(/conversión monetaria está incompleta/)
    expect(message).not.toContain('FINANCIAL_CONVERSION_INCOMPLETE')
  })
})

import type { Appointment } from '../types/appointment'
import type { AppSettings, CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import { runIncomeCalculation } from '../utils/incomeCalculation/incomeCalculatorRegistry'
import { getEffectiveFinancialDuration } from '../utils/serviceDuration'
import { claimAppointmentCompletion, getAppointmentById } from './appointmentService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  resolveEurCopExchangeRate,
} from './currencyConversionService'
import { saveExchangeRate } from './exchangeRateService'
import { createServiceIncome } from './incomeService'
import { assertRecordIsMutable, ensureActiveEarningPeriod } from './earningPeriodService'

function getDateFromDateTime(dateTime: string) {
  return dateTime.slice(0, 10)
}

function getElapsedSeconds(
  timerStartedAt: string | undefined,
  timerStoppedAt: string | undefined,
  now: Date,
) {
  if (!timerStartedAt) {
    return 0
  }

  const start = new Date(timerStartedAt)
  const end = timerStoppedAt ? new Date(timerStoppedAt) : now

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

export function getAppointmentActualDuration(
  appointment: Appointment,
  now = new Date(),
) {
  if (appointment.actualDuration !== undefined) {
    return appointment.actualDuration
  }

  if (!appointment.timerStartedAt) {
    return getEffectiveFinancialDuration(appointment) ?? appointment.duration
  }

  return Math.max(
    1,
    Math.ceil(
      getElapsedSeconds(
        appointment.timerStartedAt,
        appointment.timerStoppedAt,
        now,
      ) / 60,
    ),
  )
}

/**
 * Finaliza una cita y genera su ingreso, respetando el método de cálculo con
 * el que se agendó (snapshot inmutable en `appointment.incomeCalculationMethod`,
 * igual que en el alta manual de ingresos — PB-IS-0007). Es idempotente: si
 * la cita ya fue finalizada no hace nada y devuelve null. Nunca crea un
 * ingreso duplicado.
 *
 * La cita se re-lee siempre desde la base local (nunca se confía en el
 * objeto que pasó la UI, que puede estar obsoleto tras varias pulsaciones
 * rápidas) y la escritura que marca la cita como completada se hace de
 * forma atómica en `claimAppointmentCompletion`, que es quien realmente
 * evita que dos pulsaciones concurrentes generen dos ingresos.
 */
export async function completeAppointmentAsIncome(
  appointmentId: number,
  settings: AppSettings,
  now = new Date(),
) {
  const appointment = await getAppointmentById(appointmentId)
  if (!appointment || !appointment.id) {
    throw new Error('La cita no se puede finalizar.')
  }

  if (appointment.completed) {
    // Idempotente: nada que finalizar.
    return null
  }

  const method = appointment.incomeCalculationMethod ?? 'service_duration'

  if (method === 'hourly_workday') {
    return completeHourlyWorkdayAppointment(appointment, settings, now)
  }

  if (!appointment.timerStartedAt) {
    // Regla de dominio de "Servicio por tiempo": sin cronómetro iniciado,
    // "Servicio realizado" nunca crea un ingreso nuevo.
    return null
  }

  await assertRecordIsMutable(appointment)

  const timerStoppedAt = now.toISOString()
  const timerStartedAt = appointment.timerStartedAt
  const serviceDate = getDateFromDateTime(timerStartedAt)
  const actualDuration = getAppointmentActualDuration(appointment, now)
  const activePeriod = await ensureActiveEarningPeriod(settings)
  const { realGain } = runIncomeCalculation('service_duration', {
    totalAmount: appointment.expectedAmount,
    percentage: activePeriod.percentage,
    usageMode: 'professional',
    incomeType: 'ingreso',
  })
  const converted = await convertAppointmentRealGain(realGain, appointment, settings, serviceDate)

  // Reclamación atómica: si otra pulsación concurrente ya finalizó esta
  // cita mientras se calculaba la conversión de moneda, aquí se detecta y
  // se aborta sin crear un ingreso duplicado.
  const claimedAppointment = await claimAppointmentCompletion(appointment.id, {
    timerStoppedAt,
    actualDuration,
  })
  if (!claimedAppointment) {
    return null
  }

  await createServiceIncome({
    date: serviceDate,
    status: 'FINALIZADO',
    duration: actualDuration,
    durationLabel: appointment.durationLabel,
    totalAmount: appointment.expectedAmount,
    currency: appointment.currency,
    paymentType: appointment.paymentType,
    earningPeriodId: activePeriod.id,
    earningPercentage: activePeriod.percentage,
    percentage: activePeriod.percentage,
    realGain,
    ...converted,
    incomeCalculationMethod: 'service_duration',
    additionalsTotal: 0,
    actualDuration,
    timerStartedAt,
    timerStoppedAt,
    // El tiempo ya fue medido por la cita; el ingreso conserva las marcas
    // históricas pero no debe iniciar un segundo cronómetro.
    timerUsed: false,
    country: appointment.country ?? settings.country,
    city: appointment.city ?? settings.city,
  })

  return claimedAppointment
}

/**
 * "Jornada por horas" nunca usa cronómetro (D-011, docs/architecture/14_DECISIONS.md):
 * el tiempo trabajado es el que se tecleó al agendar/editar la cita
 * (`appointment.workedTime`), nunca uno medido. Por eso "Servicio realizado"
 * no exige haber pulsado "Iniciar servicio" para este método.
 */
async function completeHourlyWorkdayAppointment(
  appointment: Appointment,
  settings: AppSettings,
  now: Date,
) {
  await assertRecordIsMutable(appointment)

  const timerStoppedAt = now.toISOString()
  const serviceDate = getDateFromDateTime(appointment.dateTime)
  const activePeriod = await ensureActiveEarningPeriod(settings)
  const { realGain } = runIncomeCalculation('hourly_workday', {
    totalAmount: 0,
    percentage: activePeriod.percentage,
    usageMode: 'professional',
    incomeType: 'ingreso',
    workedTime: appointment.workedTime,
    workedTimeUnit: appointment.workedTimeUnit,
    hourlyRate: appointment.hourlyRateApplied,
  })
  const converted = await convertAppointmentRealGain(realGain, appointment, settings, serviceDate)

  const claimedAppointment = await claimAppointmentCompletion(appointment.id as number, {
    timerStoppedAt,
    actualDuration: 0,
  })
  if (!claimedAppointment) {
    return null
  }

  await createServiceIncome({
    date: serviceDate,
    status: 'FINALIZADO',
    duration: 0,
    durationLabel: undefined,
    totalAmount: realGain,
    currency: appointment.currency,
    // "Jornada por horas" no solicita tipo de pago al agendar; se deja sin
    // enviar y es incomeService.ts (normalizePaymentTypeForMethod) quien
    // aplica el mismo comportamiento canónico que el alta manual.
    paymentType: undefined,
    earningPeriodId: activePeriod.id,
    // "Jornada por horas" nunca aplica el % de temporada (D-011): el pago
    // por hora ya es el 100% del ingreso final de la profesional.
    earningPercentage: 0,
    percentage: 0,
    realGain,
    ...converted,
    incomeCalculationMethod: 'hourly_workday',
    workedTime: appointment.workedTime,
    workedTimeUnit: appointment.workedTimeUnit,
    hourlyRateApplied: appointment.hourlyRateApplied,
    additionalsTotal: 0,
    actualDuration: 0,
    // Nunca hubo cronómetro: no se persisten marcas de inicio/fin de servicio.
    timerUsed: false,
    country: appointment.country ?? settings.country,
    city: appointment.city ?? settings.city,
  })

  return claimedAppointment
}

async function convertAppointmentRealGain(
  realGain: number,
  appointment: Pick<Appointment, 'currency'>,
  settings: AppSettings,
  serviceDate: string,
) {
  const conversionOptions = {
    date: serviceDate,
    useApi: settings.rateMode === 'automatic',
  }
  const [convertedPairValues, convertedEurCopValues, eurCopRate] =
    await Promise.all([
      convertCurrencyPair(
        realGain,
        appointment.currency as CurrencyCode,
        settings.secondaryCurrency,
        conversionOptions,
      ),
      convertCurrencyToEurCop(
        realGain,
        appointment.currency as CurrencyCode,
        conversionOptions,
      ),
      resolveEurCopExchangeRate(conversionOptions),
    ])

  if (convertedPairValues.source !== 'api') {
    await saveExchangeRate({
      baseCurrency: appointment.currency as CurrencyCode,
      targetCurrency: settings.secondaryCurrency,
      rate: convertedPairValues.rate,
      date: serviceDate,
      source: 'manual',
    })
  }

  return {
    eurValue: roundMoney(convertedEurCopValues.eurValue),
    copValue: roundMoney(convertedEurCopValues.copValue),
    exchangeRateUsed: eurCopRate.rate,
    baseCurrency: appointment.currency,
    secondaryCurrency: settings.secondaryCurrency,
    baseCurrencyValue: roundMoney(convertedPairValues.primaryValue),
    secondaryCurrencyValue: roundMoney(convertedPairValues.secondaryValue),
    exchangeRateBaseToSecondary: convertedPairValues.rate,
  }
}

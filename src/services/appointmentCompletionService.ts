import type { Appointment } from '../types/appointment'
import type { AppSettings, CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import { calculateStoredRealGain } from '../utils/realGain'
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
 * Finaliza el servicio activo de una cita y genera su ingreso. Es
 * idempotente: si la cita ya fue finalizada, o si nunca se inició un
 * servicio para ella (nunca se pulsó "Iniciar servicio"), no hace nada y
 * devuelve null en vez de crear un ingreso. Nunca crea un servicio nuevo.
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

  if (appointment.completed || !appointment.timerStartedAt) {
    // Idempotente / regla de dominio: nada que finalizar.
    return null
  }

  await assertRecordIsMutable(appointment)

  const timerStoppedAt = now.toISOString()
  const timerStartedAt = appointment.timerStartedAt
  const serviceDate = getDateFromDateTime(timerStartedAt)
  const actualDuration = getAppointmentActualDuration(appointment, now)
  const conversionOptions = {
    date: serviceDate,
    useApi: settings.rateMode === 'automatic',
  }
  const activePeriod = await ensureActiveEarningPeriod(settings)
  const realGain = calculateStoredRealGain({
    totalAmount: appointment.expectedAmount,
    percentage: activePeriod.percentage,
    usageMode: 'professional',
    incomeType: 'ingreso',
  })
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
    earningPeriodId: activePeriod.id,
    earningPercentage: activePeriod.percentage,
    percentage: activePeriod.percentage,
    realGain,
    eurValue: roundMoney(convertedEurCopValues.eurValue),
    copValue: roundMoney(convertedEurCopValues.copValue),
    exchangeRateUsed: eurCopRate.rate,
    baseCurrency: appointment.currency,
    secondaryCurrency: settings.secondaryCurrency,
    baseCurrencyValue: roundMoney(convertedPairValues.primaryValue),
    secondaryCurrencyValue: roundMoney(convertedPairValues.secondaryValue),
    exchangeRateBaseToSecondary: convertedPairValues.rate,
    // Una cita agendada siempre corresponde al cronómetro de "Servicio por
    // tiempo" (PB-IS-0007, 43.3): nunca debe depender de la configuración de
    // método del usuario ni ofrecer Adicionales.
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

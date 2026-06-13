import type { Appointment } from '../types/appointment'
import type { AppSettings, CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import { updateAppointment } from './appointmentService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  resolveEurCopExchangeRate,
} from './currencyConversionService'
import { saveExchangeRate } from './exchangeRateService'
import { createServiceIncome } from './incomeService'

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
    return appointment.duration
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

export async function completeAppointmentAsIncome(
  appointment: Appointment,
  settings: AppSettings,
  now = new Date(),
) {
  if (!appointment.id || appointment.completed) {
    throw new Error('La cita no se puede finalizar.')
  }

  const timerStoppedAt = now.toISOString()
  const timerStartedAt = appointment.timerStartedAt ?? appointment.dateTime
  const serviceDate = getDateFromDateTime(timerStartedAt)
  const actualDuration = getAppointmentActualDuration(appointment, now)
  const conversionOptions = {
    date: serviceDate,
    useApi: settings.rateMode === 'automatic',
  }
  const realGain = roundMoney(
    (appointment.expectedAmount * settings.incomePercentage) / 100,
  )
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

  await createServiceIncome({
    date: serviceDate,
    status: 'FINALIZADO',
    duration: actualDuration,
    totalAmount: appointment.expectedAmount,
    currency: appointment.currency,
    percentage: settings.incomePercentage,
    realGain,
    eurValue: roundMoney(convertedEurCopValues.eurValue),
    copValue: roundMoney(convertedEurCopValues.copValue),
    exchangeRateUsed: eurCopRate.rate,
    baseCurrency: appointment.currency,
    secondaryCurrency: settings.secondaryCurrency,
    baseCurrencyValue: roundMoney(convertedPairValues.primaryValue),
    secondaryCurrencyValue: roundMoney(convertedPairValues.secondaryValue),
    exchangeRateBaseToSecondary: convertedPairValues.rate,
    actualDuration,
    timerStartedAt,
    timerStoppedAt,
    country: settings.country,
    city: settings.city,
  })

  await updateAppointment(appointment.id, {
    actualDuration,
    completed: true,
    timerStartedAt,
    timerStoppedAt,
  })
}

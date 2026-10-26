import { DEFAULT_SETTINGS_ID, db } from '../database/db'
import type { Appointment } from '../types/appointment'
import type { EarningPeriod } from '../types/earningPeriod'
import type { SeasonStay } from '../types/seasonStay'
import type { ServiceIncome } from '../types/service'
import type { AppSettings, CurrencyCode } from '../types/settings'
import { assertRecordIsNotReported, normalizeReportStatus } from '../catalogs/reportStatuses'
import { roundMoney } from '../utils/currency'
import { runIncomeCalculation } from '../utils/incomeCalculation/incomeCalculatorRegistry'
import { getEffectiveFinancialDuration } from '../utils/serviceDuration'
import { SeasonGeoDomainError } from '../utils/seasonGeoValidation'
import { createAutomationOutboxRecord, scheduleAutomationOutboxFlush } from './automationOutboxService'
import { cancelAppointmentReminders } from './reminderService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  resolveEurCopExchangeRate,
} from './currencyConversionService'
import { saveExchangeRate } from './exchangeRateService'
import { resolveCreateRecordGeography } from './recordGeographyService'

export type AppointmentCompletionErrorCode =
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_PRECONDITION_CHANGED'
  | 'APPOINTMENT_SEASON_INVALID'
  | 'APPOINTMENT_COMPLETION_INTEGRITY_ERROR'

export class AppointmentCompletionError extends Error {
  readonly code: AppointmentCompletionErrorCode

  constructor(code: AppointmentCompletionErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AppointmentCompletionError'
  }
}

export interface CompleteAppointmentOptions {
  plannedStayResolution?: { action: 'detach'; reason: string }
}

export type CompleteAppointmentResult =
  | {
      status: 'completed'
      appointment: Appointment
      income: ServiceIncome
      postCommitWarnings: Array<'REMINDER_CANCELLATION_FAILED'>
    }
  | {
      status: 'already_completed'
      appointment: Appointment
      income?: ServiceIncome
      postCommitWarnings: []
    }

interface PreparedCompletion {
  appointment: Appointment
  period: EarningPeriod
  stay?: SeasonStay
  settings: AppSettings
  effectiveAt: string
  serviceDate: string
  actualDuration: number
  converted: Awaited<ReturnType<typeof convertAppointmentRealGain>>
  fingerprint: string
  options: CompleteAppointmentOptions
}

function getDateFromDateTime(dateTime: string) {
  return dateTime.slice(0, 10)
}

function getElapsedSeconds(timerStartedAt: string | undefined, timerStoppedAt: string | undefined, now: Date) {
  if (!timerStartedAt) return 0
  const start = new Date(timerStartedAt)
  const end = timerStoppedAt ? new Date(timerStoppedAt) : now
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

export function getAppointmentActualDuration(appointment: Appointment, now = new Date()) {
  if (appointment.actualDuration !== undefined) return appointment.actualDuration
  if (!appointment.timerStartedAt) {
    return getEffectiveFinancialDuration(appointment) ?? appointment.duration
  }
  return Math.max(1, Math.ceil(getElapsedSeconds(
    appointment.timerStartedAt,
    appointment.timerStoppedAt,
    now,
  ) / 60))
}

function resolveAppointmentPeriodId(appointment: Appointment) {
  if (appointment.earningPeriodId !== undefined && appointment.seasonPeriodId !== undefined &&
    appointment.earningPeriodId !== appointment.seasonPeriodId) {
    throw new AppointmentCompletionError(
      'APPOINTMENT_SEASON_INVALID',
      'La cita contiene referencias de temporada incompatibles.',
    )
  }
  return appointment.earningPeriodId ?? appointment.seasonPeriodId
}

async function loadCompletionPeriod(appointment: Appointment) {
  const periodId = resolveAppointmentPeriodId(appointment)
  if (periodId) return db.earningPeriods.get(periodId)
  const active = await db.earningPeriods.where('status').equals('active').toArray()
  return active.sort((left, right) => right.startDate.localeCompare(left.startDate))[0]
}

function assertPeriodCanBeCompleted(period: EarningPeriod | undefined): asserts period is EarningPeriod & { id: number } {
  if (!period?.id || period.status !== 'active') {
    throw new AppointmentCompletionError(
      'APPOINTMENT_SEASON_INVALID',
      'La cita no pertenece a una temporada activa.',
    )
  }
}

function buildPreconditionFingerprint(input: {
  appointment: Appointment
  period: EarningPeriod
  stay?: SeasonStay
  settings: AppSettings
}) {
  const { appointment, period, stay, settings } = input
  return JSON.stringify({
    appointment: {
      id: appointment.id,
      completed: appointment.completed,
      completedIncomeId: appointment.completedIncomeId,
      dateTime: appointment.dateTime,
      duration: appointment.duration,
      expectedAmount: appointment.expectedAmount,
      currency: appointment.currency,
      paymentType: appointment.paymentType,
      incomeCalculationMethod: appointment.incomeCalculationMethod,
      workedTime: appointment.workedTime,
      workedTimeUnit: appointment.workedTimeUnit,
      hourlyRateApplied: appointment.hourlyRateApplied,
      timerStartedAt: appointment.timerStartedAt,
      timerStoppedAt: appointment.timerStoppedAt,
      actualDuration: appointment.actualDuration,
      earningPeriodId: appointment.earningPeriodId,
      seasonPeriodId: appointment.seasonPeriodId,
      seasonStayId: appointment.seasonStayId,
      travelDestination: appointment.travelDestination,
      city: appointment.city,
      country: appointment.country,
      reportStatusCode: appointment.reportStatusCode,
    },
    period: {
      id: period.id,
      status: period.status,
      percentage: period.percentage,
      countryCode: period.countryCode,
      baseCurrency: period.baseCurrency,
    },
    stay: stay ? {
      id: stay.id,
      earningPeriodId: stay.earningPeriodId,
      status: stay.status,
      city: stay.city,
      countryCode: stay.countryCode,
      actualStartAt: stay.actualStartAt,
      actualEndAt: stay.actualEndAt,
      plannedStartDate: stay.plannedStartDate,
      plannedEndDate: stay.plannedEndDate,
      updatedAt: stay.updatedAt,
    } : undefined,
    settings: {
      secondaryCurrency: settings.secondaryCurrency,
      rateMode: settings.rateMode,
      country: settings.country,
      city: settings.city,
    },
  })
}

function calculateAppointmentIncome(appointment: Appointment, period: EarningPeriod) {
  const method = appointment.incomeCalculationMethod ?? 'service_duration'
  if (method === 'hourly_workday') {
    return runIncomeCalculation('hourly_workday', {
      totalAmount: 0,
      percentage: period.percentage,
      usageMode: 'professional',
      incomeType: 'ingreso',
      workedTime: appointment.workedTime,
      workedTimeUnit: appointment.workedTimeUnit,
      hourlyRate: appointment.hourlyRateApplied,
    }).realGain
  }
  return runIncomeCalculation('service_duration', {
    totalAmount: appointment.expectedAmount,
    percentage: period.percentage,
    usageMode: 'professional',
    incomeType: 'ingreso',
  }).realGain
}

function assertPlannedStayResolution(stay: SeasonStay | undefined, options: CompleteAppointmentOptions) {
  if (stay?.status !== 'planned') return
  const resolution = options.plannedStayResolution
  if (!resolution || resolution.action !== 'detach') {
    throw new SeasonGeoDomainError(
      'STAY_NOT_STARTED',
      'La estancia planificada debe activarse o desvincularse antes de finalizar la cita.',
    )
  }
  if (!resolution.reason.trim()) {
    throw new SeasonGeoDomainError(
      'CORRECTION_REASON_REQUIRED',
      'La desvinculación de la estancia requiere un motivo.',
    )
  }
}

async function prepareAppointmentCompletion(
  appointmentId: number,
  fallbackSettings: AppSettings,
  now: Date,
  options: CompleteAppointmentOptions,
): Promise<PreparedCompletion | CompleteAppointmentResult> {
  const [appointment, storedSettings] = await Promise.all([
    db.appointments.get(appointmentId),
    db.settings.get(DEFAULT_SETTINGS_ID),
  ])
  if (!appointment?.id) {
    throw new AppointmentCompletionError('APPOINTMENT_NOT_FOUND', 'La cita no se puede finalizar.')
  }
  if (appointment.completed) {
    const income = appointment.completedIncomeId
      ? await db.services.get(appointment.completedIncomeId)
      : undefined
    return { status: 'already_completed', appointment, income, postCommitWarnings: [] }
  }
  assertRecordIsNotReported(appointment)
  const settings = storedSettings ?? fallbackSettings
  const period = await loadCompletionPeriod(appointment)
  assertPeriodCanBeCompleted(period)
  const stay = appointment.seasonStayId
    ? await db.seasonStays.get(appointment.seasonStayId)
    : undefined
  if (appointment.seasonStayId && !stay) {
    throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia vinculada a la cita no existe.')
  }
  assertPlannedStayResolution(stay, options)

  const method = appointment.incomeCalculationMethod ?? 'service_duration'
  if (method === 'service_duration' && !appointment.timerStartedAt) {
    throw new AppointmentCompletionError(
      'APPOINTMENT_COMPLETION_INTEGRITY_ERROR',
      'La cita de servicio por tiempo no se ha iniciado.',
    )
  }
  const effectiveAt = now.toISOString()
  const serviceDate = getDateFromDateTime(
    method === 'service_duration' ? appointment.timerStartedAt! : appointment.dateTime,
  )
  if (stay?.status !== 'planned') {
    await resolveCreateRecordGeography({ seasonStayId: appointment.seasonStayId }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: period.id,
      temporalValue: serviceDate,
    })
  }
  const realGain = calculateAppointmentIncome(appointment, period)
  const converted = await convertAppointmentRealGain(realGain, appointment, settings, serviceDate)
  return {
    appointment,
    period,
    stay,
    settings,
    effectiveAt,
    serviceDate,
    actualDuration: method === 'hourly_workday' ? 0 : getAppointmentActualDuration(appointment, now),
    converted,
    fingerprint: buildPreconditionFingerprint({ appointment, period, stay, settings }),
    options,
  }
}

export function buildAppointmentCompletionIncome(input: {
  appointment: Appointment
  period: EarningPeriod
  settings: AppSettings
  effectiveAt: string
  serviceDate: string
  actualDuration: number
  converted: PreparedCompletion['converted']
  seasonStayId?: number
}): ServiceIncome {
  const { appointment, period, settings, effectiveAt, serviceDate, actualDuration, converted } = input
  const realGain = calculateAppointmentIncome(appointment, period)
  const method = appointment.incomeCalculationMethod ?? 'service_duration'
  const hourly = method === 'hourly_workday'
  const income: ServiceIncome = {
    createdAt: effectiveAt,
    updatedAt: effectiveAt,
    date: serviceDate,
    status: 'FINALIZADO',
    type: 'ingreso',
    usageMode: 'professional',
    duration: hourly ? 0 : actualDuration,
    durationLabel: hourly ? undefined : appointment.durationLabel,
    totalAmount: hourly ? realGain : appointment.expectedAmount,
    currency: appointment.currency,
    paymentType: hourly ? 'cash' : appointment.paymentType,
    earningPeriodId: period.id,
    seasonPeriodId: period.id,
    seasonStayId: input.seasonStayId,
    travelDestination: appointment.travelDestination,
    earningPercentage: hourly ? 0 : period.percentage,
    percentage: hourly ? 0 : period.percentage,
    realGain,
    ...converted,
    incomeCalculationMethod: method,
    workedTime: hourly ? appointment.workedTime : undefined,
    workedTimeUnit: hourly ? appointment.workedTimeUnit : undefined,
    hourlyRateApplied: hourly ? appointment.hourlyRateApplied : undefined,
    additionalsTotal: 0,
    actualDuration,
    timerStartedAt: hourly ? undefined : appointment.timerStartedAt,
    timerStoppedAt: hourly ? undefined : effectiveAt,
    timerUsed: false,
    country: appointment.country ?? settings.country,
    city: appointment.city ?? settings.city,
  }
  return normalizeReportStatus(income)
}

async function commitPreparedCompletion(prepared: PreparedCompletion): Promise<CompleteAppointmentResult> {
  const result: CompleteAppointmentResult = await db.transaction('rw', [
    db.appointments,
    db.services,
    db.earningPeriods,
    db.seasonStays,
    db.automationOutbox,
    db.settings,
  ], async (): Promise<CompleteAppointmentResult> => {
    const appointment = await db.appointments.get(prepared.appointment.id!)
    if (!appointment) {
      throw new AppointmentCompletionError('APPOINTMENT_NOT_FOUND', 'La cita no se puede finalizar.')
    }
    if (appointment.completed) {
      const income = appointment.completedIncomeId
        ? await db.services.get(appointment.completedIncomeId)
        : undefined
      return { status: 'already_completed', appointment, income, postCommitWarnings: [] }
    }
    assertRecordIsNotReported(appointment)
    const settings = await db.settings.get(DEFAULT_SETTINGS_ID) ?? prepared.settings
    const period = await loadCompletionPeriod(appointment)
    assertPeriodCanBeCompleted(period)
    const stay = appointment.seasonStayId
      ? await db.seasonStays.get(appointment.seasonStayId)
      : undefined
    if (appointment.seasonStayId && !stay) {
      throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia vinculada a la cita no existe.')
    }
    assertPlannedStayResolution(stay, prepared.options)
    const fingerprint = buildPreconditionFingerprint({ appointment, period, stay, settings })
    if (fingerprint !== prepared.fingerprint) {
      throw new AppointmentCompletionError(
        'APPOINTMENT_PRECONDITION_CHANGED',
        'La cita, temporada, estancia o configuración cambió durante la preparación.',
      )
    }

    const detachPlannedStay = stay?.status === 'planned'
    const resultingStayId = detachPlannedStay ? undefined : appointment.seasonStayId
    if (resultingStayId) {
      await resolveCreateRecordGeography({ seasonStayId: resultingStayId }, {
        kind: 'income', usageMode: 'professional', earningPeriodId: period.id,
        temporalValue: prepared.serviceDate,
      })
    }
    const income = buildAppointmentCompletionIncome({
      appointment,
      period,
      settings,
      effectiveAt: prepared.effectiveAt,
      serviceDate: prepared.serviceDate,
      actualDuration: prepared.actualDuration,
      converted: prepared.converted,
      seasonStayId: resultingStayId,
    })
    const incomeId = await db.services.add(income)
    const persistedIncome = { ...income, id: incomeId }
    await db.automationOutbox.add(createAutomationOutboxRecord('income.created', {
      income: persistedIncome,
    }))
    const completedAppointment: Appointment = normalizeReportStatus({
      ...appointment,
      completed: true,
      completedIncomeId: incomeId,
      timerStoppedAt: prepared.effectiveAt,
      actualDuration: prepared.actualDuration,
      ...(detachPlannedStay ? {
        seasonStayId: undefined,
        seasonStayDetachedFromId: stay!.id,
        seasonStayDetachedAt: prepared.effectiveAt,
        seasonStayDetachmentReason: prepared.options.plannedStayResolution!.reason.trim(),
      } : {}),
    }) as Appointment
    await db.appointments.put(completedAppointment)
    return {
      status: 'completed',
      appointment: completedAppointment,
      income: persistedIncome,
      postCommitWarnings: [],
    } as CompleteAppointmentResult
  })

  if (result.status === 'completed') {
    scheduleAutomationOutboxFlush()
    try {
      await cancelAppointmentReminders(result.appointment.id!)
    } catch {
      result.postCommitWarnings.push('REMINDER_CANCELLATION_FAILED')
    }
  }
  return result
}

export async function completeAppointmentAsIncome(
  appointmentId: number,
  settings: AppSettings,
  now = new Date(),
  options: CompleteAppointmentOptions = {},
) {
  const prepared = await prepareAppointmentCompletion(appointmentId, settings, now, options)
  if ('status' in prepared) return prepared
  return commitPreparedCompletion(prepared)
}

async function convertAppointmentRealGain(
  realGain: number,
  appointment: Pick<Appointment, 'currency'>,
  settings: AppSettings,
  serviceDate: string,
) {
  const conversionOptions = { date: serviceDate, useApi: settings.rateMode === 'automatic' }
  const [convertedPairValues, convertedEurCopValues, eurCopRate] = await Promise.all([
    convertCurrencyPair(realGain, appointment.currency as CurrencyCode, settings.secondaryCurrency, conversionOptions),
    convertCurrencyToEurCop(realGain, appointment.currency as CurrencyCode, conversionOptions),
    resolveEurCopExchangeRate(conversionOptions),
  ])

  if (convertedPairValues.source !== 'api') {
    try {
      await saveExchangeRate({
        baseCurrency: appointment.currency as CurrencyCode,
        targetCurrency: settings.secondaryCurrency,
        rate: convertedPairValues.rate,
        date: serviceDate,
        source: 'manual',
      })
    } catch {
      // La cotización válida permanece en el ingreso; el fallo de caché es auxiliar.
    }
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

import { db } from '../database/db'
import { createEarningPeriod, getActiveEarningPeriod } from './earningPeriodService'
import { getSettings, updateSettings } from './settingsService'
import type { InitialSeasonDraft, OnboardingState } from '../types/onboarding'
import type { CurrencyCode, UsageMode } from '../types/settings'
import type { IncomeCalculationMethod } from '../catalogs/incomeCalculationMethods'
import {
  createCompletedOnboardingState,
  getOnboardingIncomeCalculationSettings,
} from '../utils/onboarding'

/**
 * Detecta usuarios con datos previos que nunca pasaron por el onboarding
 * (p. ej. una fila de settings creada antes de la migración de Dexie que
 * introdujo `onboarding`, o cualquier estado inconsistente). La migración
 * de la versión 28 ya cubre el caso normal; esta comprobación es la red de
 * seguridad para no repetir el onboarding a quien ya tiene ingresos, gastos
 * o un PIN configurado.
 */
export async function hasExistingUserData(): Promise<boolean> {
  const [serviceCount, expenseCount, appointmentCount, settings] = await Promise.all([
    db.services.count(),
    db.expenses.count(),
    db.appointments.count(),
    getSettings(),
  ])

  return (
    serviceCount > 0 ||
    expenseCount > 0 ||
    appointmentCount > 0 ||
    settings.pinEnabled ||
    settings.businessName.trim().length > 0
  )
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const settings = await ensureOnboardingCompletedForExistingUsers()

  return settings.onboarding
}

export async function ensureOnboardingCompletedForExistingUsers() {
  const settings = await getSettings()

  if (settings.onboarding.completed) {
    return settings
  }

  // Solo se aplica si el onboarding nunca se empezó (currentStep 0): una vez el
  // usuario está avanzando por el flujo (p. ej. ya configuró su PIN en el paso
  // de seguridad), esa misma actividad no debe hacer que se dé por completado
  // saltándose el resto de pasos.
  if (settings.onboarding.currentStep > 0 || !(await hasExistingUserData())) {
    return settings
  }

  return updateSettings({
    onboarding: createCompletedOnboardingState(new Date().toISOString()),
  })
}

export function setOnboardingStep(currentStep: number) {
  return getSettings().then((settings) =>
    updateSettings({
      onboarding: { ...settings.onboarding, currentStep },
    }),
  )
}

export async function configureOnboardingUsageMode(usageMode: UsageMode) {
  const settings = await getSettings()

  return updateSettings(
    {
      onboarding: {
        ...settings.onboarding,
        initialSeason:
          usageMode === 'professional'
            ? settings.onboarding.initialSeason
            : undefined,
      },
      usageMode,
    },
    { allowUsageModeChange: true },
  )
}

export function configureOnboardingIncomeCalculationMethod(
  incomeCalculationMethod: IncomeCalculationMethod,
  hourlyRate?: number,
) {
  return updateSettings(
    getOnboardingIncomeCalculationSettings(incomeCalculationMethod, hourlyRate),
  )
}

export async function saveInitialSeasonDraft(initialSeason: InitialSeasonDraft) {
  const name = initialSeason.name.trim()

  if (!name) throw new Error('Indica un nombre para la temporada.')
  if (!initialSeason.startDate) throw new Error('Indica la fecha de inicio.')
  if (!initialSeason.plannedEndDate) {
    throw new Error('Indica la finalización prevista.')
  }
  if (initialSeason.plannedEndDate < initialSeason.startDate) {
    throw new Error('La finalización prevista no puede ser anterior al inicio.')
  }
  if (
    initialSeason.economicGoal === undefined ||
    !Number.isFinite(initialSeason.economicGoal) ||
    initialSeason.economicGoal <= 0
  ) {
    throw new Error('La meta económica debe ser mayor a cero.')
  }
  if (
    !Number.isFinite(initialSeason.earningPercentage) ||
    initialSeason.earningPercentage < 0 ||
    initialSeason.earningPercentage > 100
  ) {
    throw new Error('El porcentaje de ganancia debe estar entre 0 y 100.')
  }

  const settings = await getSettings()
  return updateSettings({
    onboarding: {
      ...settings.onboarding,
      initialSeason: { ...initialSeason, name },
    },
  })
}

function activeSeasonMatchesDraft(
  active: NonNullable<Awaited<ReturnType<typeof getActiveEarningPeriod>>>,
  draft: InitialSeasonDraft,
) {
  return (
    active.name === draft.name &&
    active.startDate.slice(0, 10) === draft.startDate &&
    active.plannedEndDate?.slice(0, 10) === draft.plannedEndDate &&
    active.economicGoal === draft.economicGoal
  )
}

export async function configureOnboardingCurrency(currency: CurrencyCode) {
  const settings = await getSettings()

  if (settings.usageMode === 'basic') {
    return updateSettings({ defaultCurrency: currency })
  }

  const draft = settings.onboarding.initialSeason
  if (!draft) throw new Error('Completa primero los datos de la temporada.')

  const active = await getActiveEarningPeriod()
  if (active && !activeSeasonMatchesDraft(active, draft)) {
    throw new Error('Ya existe una temporada activa diferente.')
  }

  if (!active) {
    await createEarningPeriod({
      name: draft.name,
      city: settings.city,
      country: settings.country,
      countryCode: settings.country,
      baseCurrency: currency,
      earningPercentage: draft.earningPercentage,
      startDate: draft.startDate,
      plannedEndDate: draft.plannedEndDate,
      economicGoal: draft.economicGoal,
    })
  }

  return updateSettings({ defaultCurrency: currency })
}

export async function setOnboardingBackupRequested(backupRequested: boolean) {
  const settings = await getSettings()
  return updateSettings({
    onboarding: { ...settings.onboarding, backupRequested },
  })
}

export async function completeOnboarding() {
  return updateSettings({
    onboarding: createCompletedOnboardingState(new Date().toISOString()),
  })
}

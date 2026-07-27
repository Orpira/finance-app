import { db } from '../database/db'
import { getSettings, updateSettings } from './settingsService'
import type { OnboardingState } from '../types/onboarding'
import { createCompletedOnboardingState } from '../utils/onboarding'

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

export async function completeOnboarding() {
  return updateSettings({
    onboarding: createCompletedOnboardingState(new Date().toISOString()),
  })
}

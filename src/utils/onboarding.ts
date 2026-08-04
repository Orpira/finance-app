import {
  CURRENT_ONBOARDING_VERSION,
  LAST_ONBOARDING_STEP_INDEX,
  type OnboardingState,
} from '../types/onboarding'
import type { WorkedTimeUnit } from '../catalogs/incomeCalculationMethods'

export const DEFAULT_LANGUAGE = 'es'
export const DEFAULT_TIME_ZONE = 'Europe/Madrid'
export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy'

export function createDefaultOnboardingState(): OnboardingState {
  return {
    completed: false,
    currentStep: 0,
    version: CURRENT_ONBOARDING_VERSION,
  }
}

export function createCompletedOnboardingState(completedAt: string): OnboardingState {
  return {
    completed: true,
    completedAt,
    currentStep: LAST_ONBOARDING_STEP_INDEX,
    version: CURRENT_ONBOARDING_VERSION,
  }
}

export function getOnboardingWorkModeSettings(workedTimeUnit: WorkedTimeUnit) {
  return {
    workedTimeUnit,
  }
}

export function resolveOnboardingEarningPercentage(
  earningPercentage: number,
  percentageNotApplicable: boolean,
) {
  return percentageNotApplicable ? 100 : earningPercentage
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function detectLanguage(): string {
  try {
    const navigatorLanguage =
      typeof navigator !== 'undefined' ? navigator.language : undefined
    return navigatorLanguage ? navigatorLanguage.split('-')[0] : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/**
 * Deriva el país desde `navigator.language` (p. ej. "es-MX" -> "MX") solo
 * cuando ese país está entre los soportados; si no se puede detectar,
 * el llamador debe usar el país manual/por defecto.
 */
export function detectCountryCode(supportedCountryCodes: readonly string[]): string | undefined {
  try {
    const navigatorLanguage = typeof navigator !== 'undefined' ? navigator.language : undefined
    if (!navigatorLanguage) return undefined

    const region = new Intl.Locale(navigatorLanguage).maximize().region

    return region && supportedCountryCodes.includes(region) ? region : undefined
  } catch {
    return undefined
  }
}

export interface DateFormatOption {
  value: string
  label: string
}

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { value: 'dd/MM/yyyy', label: 'DD/MM/AAAA' },
  { value: 'MM/dd/yyyy', label: 'MM/DD/AAAA' },
  { value: 'yyyy-MM-dd', label: 'AAAA-MM-DD' },
]

export function formatDateWithPattern(date: Date, pattern: string): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())

  return pattern.replace('dd', day).replace('MM', month).replace('yyyy', year)
}

export function detectAvailableTimeZones(): string[] {
  try {
    const supportedValuesOf = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[]
    }).supportedValuesOf

    return supportedValuesOf ? supportedValuesOf('timeZone') : []
  } catch {
    return []
  }
}

export interface OnboardingPreferencesInput {
  language: string
  countryCode: string
  currencyCode: string
  timeZone: string
  dateFormat: string
}

export type OnboardingPreferencesErrors = Partial<
  Record<keyof OnboardingPreferencesInput, string>
>

export function validateOnboardingPreferences(
  preferences: OnboardingPreferencesInput,
): OnboardingPreferencesErrors {
  const errors: OnboardingPreferencesErrors = {}

  if (!preferences.language.trim()) errors.language = 'Selecciona un idioma.'
  if (!preferences.countryCode.trim()) errors.countryCode = 'Selecciona un país.'
  if (!preferences.currencyCode.trim()) errors.currencyCode = 'Selecciona una moneda.'
  if (!preferences.timeZone.trim()) errors.timeZone = 'Selecciona una zona horaria.'
  if (!preferences.dateFormat.trim()) errors.dateFormat = 'Selecciona un formato de fecha.'

  return errors
}

/**
 * Primer identificador de la lista de candidatos que está presente en el DOM
 * real de Inicio en este momento (ver TutorialOverlay.tsx). Permite que el
 * tutorial se adapte quitando pasos cuyo elemento no existe (p. ej. la
 * tarjeta de ingresos pendientes en modo básico) en vez de señalar el vacío.
 */
export function pickFirstAvailableTutorialTarget(
  candidateKeys: readonly string[],
  presentKeys: ReadonlySet<string>,
): string | undefined {
  return candidateKeys.find((key) => presentKeys.has(key))
}

export interface InitialScreenInput {
  appIsReady: boolean
  onboardingCompleted: boolean
  securityEnabled: boolean
  sessionUnlocked: boolean
}

export type InitialScreen = 'splash' | 'onboarding' | 'lock' | 'main'

/**
 * Punto único de decisión de navegación inicial. OnboardingGate resuelve
 * 'splash'/'onboarding'/delegar; PinGate (ya existente) resuelve 'lock'/'main'
 * dentro de esa delegación — ver src/components/onboarding/OnboardingGate.tsx.
 */
export function resolveInitialScreen({
  appIsReady,
  onboardingCompleted,
  securityEnabled,
  sessionUnlocked,
}: InitialScreenInput): InitialScreen {
  if (!appIsReady) return 'splash'
  if (!onboardingCompleted) return 'onboarding'
  if (securityEnabled && !sessionUnlocked) return 'lock'
  return 'main'
}

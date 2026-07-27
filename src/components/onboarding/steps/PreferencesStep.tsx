import { type FormEvent, useEffect, useState } from 'react'

import { getSettings, updateSettings } from '../../../services/settingsService'
import type { CountryCode, CurrencyCode } from '../../../types/settings'
import { countries, currencies, getCountryCurrency } from '../../../utils/countries'
import {
  DATE_FORMAT_OPTIONS,
  DEFAULT_LANGUAGE,
  detectAvailableTimeZones,
  detectCountryCode,
  detectTimeZone,
  formatDateWithPattern,
  type OnboardingPreferencesErrors,
  validateOnboardingPreferences,
} from '../../../utils/onboarding'
import { OnboardingLayout } from '../OnboardingLayout'

interface PreferencesForm {
  language: string
  countryCode: CountryCode
  currencyCode: CurrencyCode
  timeZone: string
  dateFormat: string
}

interface PreferencesStepProps {
  currentStep: number
  onNext: () => void
}

const languageOptions = [{ value: DEFAULT_LANGUAGE, label: 'Español' }]

export function PreferencesStep({ currentStep, onNext }: PreferencesStepProps) {
  const [form, setForm] = useState<PreferencesForm | null>(null)
  const [errors, setErrors] = useState<OnboardingPreferencesErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [timeZoneOptions] = useState<string[]>(() => detectAvailableTimeZones())

  useEffect(() => {
    let mounted = true

    getSettings().then((settings) => {
      if (!mounted) return

      const isUntouchedDefault = settings.country === 'ES' && settings.defaultCurrency === 'EUR'
      const detectedCountry = isUntouchedDefault
        ? detectCountryCode(countries.map((country) => country.value))
        : undefined
      const countryCode = (detectedCountry as CountryCode | undefined) ?? settings.country

      setForm({
        language: settings.language,
        countryCode,
        currencyCode: getCountryCurrency(countryCode) ?? settings.defaultCurrency,
        timeZone: settings.timeZone || detectTimeZone(),
        dateFormat: settings.dateFormat,
      })
    })

    return () => {
      mounted = false
    }
  }, [])

  if (!form) {
    return (
      <OnboardingLayout currentStep={currentStep} footer={null} title="Preferencias">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">Cargando...</p>
      </OnboardingLayout>
    )
  }

  function updateForm(updates: Partial<PreferencesForm>) {
    setForm((current) => (current ? { ...current, ...updates } : current))
  }

  function handleCountryChange(countryCode: CountryCode) {
    updateForm({
      countryCode,
      currencyCode: getCountryCurrency(countryCode) ?? form?.currencyCode ?? 'EUR',
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return

    const validationErrors = validateOnboardingPreferences(form)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      await updateSettings({
        language: form.language,
        country: form.countryCode,
        defaultCurrency: form.currencyCode,
        timeZone: form.timeZone,
        dateFormat: form.dateFormat,
      })
      onNext()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Se usan para tus reportes y para formatear cantidades y fechas."
      footer={
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={isSaving}
          form="onboarding-preferences-form"
          type="submit"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      title="Configuración inicial"
    >
      <form
        className="flex flex-col gap-4 text-left"
        id="onboarding-preferences-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Idioma</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            onChange={(event) => updateForm({ language: event.target.value })}
            value={form.language}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.language && <p aria-live="polite" className="text-sm text-red-600">{errors.language}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">País</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
            value={form.countryCode}
          >
            {countries.map((country) => (
              <option key={country.value} value={country.value}>{country.label}</option>
            ))}
          </select>
          {errors.countryCode && <p aria-live="polite" className="text-sm text-red-600">{errors.countryCode}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Moneda principal</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-950 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            disabled
            value={form.currencyCode}
          >
            {currencies.map((currency) => (
              <option key={currency.value} value={currency.value}>{currency.label}</option>
            ))}
          </select>
          {errors.currencyCode && <p aria-live="polite" className="text-sm text-red-600">{errors.currencyCode}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Zona horaria</span>
          {timeZoneOptions.length > 0 ? (
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              onChange={(event) => updateForm({ timeZone: event.target.value })}
              value={form.timeZone}
            >
              {!timeZoneOptions.includes(form.timeZone) && (
                <option value={form.timeZone}>{form.timeZone}</option>
              )}
              {timeZoneOptions.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          ) : (
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              onChange={(event) => updateForm({ timeZone: event.target.value })}
              type="text"
              value={form.timeZone}
            />
          )}
          {errors.timeZone && <p aria-live="polite" className="text-sm text-red-600">{errors.timeZone}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato de fecha</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            onChange={(event) => updateForm({ dateFormat: event.target.value })}
            value={form.dateFormat}
          >
            {DATE_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({formatDateWithPattern(new Date(), option.value)})
              </option>
            ))}
          </select>
          {errors.dateFormat && <p aria-live="polite" className="text-sm text-red-600">{errors.dateFormat}</p>}
        </label>
      </form>
    </OnboardingLayout>
  )
}

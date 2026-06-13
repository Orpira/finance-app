import { LockKeyhole, Save, ShieldOff } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import {
  changePin,
  removePin,
  setPin,
} from '../../services/pinService'
import {
  applyTheme,
  getSettings,
  updateSettings,
} from '../../services/settingsService'
import { listCityOptions } from '../../services/locationService'
import type {
  AppSettings,
  CurrencyCode,
  RateMode,
  ThemeMode,
} from '../../types/settings'
import {
  type CityOption,
  countries,
  currencies,
  fallbackCityOptions,
  getCityOption,
  getCountryCurrency,
} from '../../utils/countries'
import { isValidPin } from '../../utils/pin'

const rateModes: Array<{ value: RateMode; label: string }> = [
  { value: 'automatic', label: 'Automático' },
  { value: 'manual', label: 'Manual' },
]

const themes: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type PinStatus = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<PinStatus>('idle')
  const [pinMessage, setPinMessage] = useState('')
  const [cityOptions, setCityOptions] =
    useState<CityOption[]>(fallbackCityOptions)
  const [isLoadingCities, setIsLoadingCities] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentCityOptions] = await Promise.all([
        getSettings(),
        listCityOptions(),
      ])

      if (isMounted) {
        setSettings(currentSettings)
        setCityOptions(currentCityOptions)
        setIsLoadingCities(false)
      }
    }

    setIsLoadingCities(true)
    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    setSaveStatus('saving')

    try {
      const updatedSettings = await updateSettings({
        businessName: settings.businessName.trim(),
        country: settings.country,
        city: settings.city.trim(),
        defaultCurrency: settings.defaultCurrency,
        secondaryCurrency: settings.secondaryCurrency,
        incomePercentage: settings.incomePercentage,
        rateMode: settings.rateMode,
        theme: settings.theme,
      })

      setSettings(updatedSettings)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  function updateLocalSettings(updates: Partial<AppSettings>) {
    if (updates.theme) {
      applyTheme(updates.theme)
    }

    setSettings((currentSettings) =>
      currentSettings ? { ...currentSettings, ...updates } : currentSettings,
    )
    setSaveStatus('idle')
  }

  function handleCityChange(city: string) {
    const selectedCity = getCityOption(city, cityOptions)

    if (!selectedCity) {
      updateLocalSettings({ city })
      return
    }

    updateLocalSettings({
      city: selectedCity.value,
      country: selectedCity.country,
      defaultCurrency:
        getCountryCurrency(selectedCity.country) ??
        settings?.defaultCurrency ??
        'EUR',
    })
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    if (!isValidPin(nextPin)) {
      setPinStatus('error')
      setPinMessage('El PIN debe tener entre 4 y 6 números.')
      return
    }

    if (nextPin !== confirmPin) {
      setPinStatus('error')
      setPinMessage('La confirmación no coincide.')
      return
    }

    setPinStatus('saving')
    setPinMessage('')

    try {
      const updatedSettings = settings.pinEnabled
        ? await changePin(currentPin, nextPin)
        : await setPin(nextPin)

      setSettings(updatedSettings)
      setCurrentPin('')
      setNextPin('')
      setConfirmPin('')
      setPinStatus('saved')
      setPinMessage(settings.pinEnabled ? 'PIN actualizado' : 'PIN activado')
    } catch (error) {
      setPinStatus('error')
      setPinMessage(
        error instanceof Error ? error.message : 'No se pudo guardar el PIN.',
      )
    }
  }

  async function handleDisablePin() {
    if (!settings) {
      return
    }

    setPinStatus('saving')
    setPinMessage('')

    try {
      const updatedSettings = await removePin(currentPin)

      setSettings(updatedSettings)
      setCurrentPin('')
      setNextPin('')
      setConfirmPin('')
      setPinStatus('saved')
      setPinMessage('PIN desactivado')
    } catch (error) {
      setPinStatus('error')
      setPinMessage(
        error instanceof Error ? error.message : 'No se pudo desactivar el PIN.',
      )
    }
  }

  function handlePinInput(value: string, onChange: (value: string) => void) {
    onChange(value.replace(/\D/g, '').slice(0, 6))
    setPinStatus('idle')
    setPinMessage('')
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">Configuración</p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Negocio, moneda y seguridad
        </h1>
      </header>

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Nombre del negocio
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                updateLocalSettings({ businessName: event.target.value })
              }
              placeholder="Mi negocio"
              type="text"
              value={settings.businessName}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Ciudad</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              list="city-options"
              onChange={(event) => handleCityChange(event.target.value)}
              placeholder={
                isLoadingCities ? 'Cargando ciudades...' : 'Busca una ciudad'
              }
              type="text"
              value={settings.city}
            />
            <datalist id="city-options">
              {cityOptions.map((city) => (
                <option
                  key={`${city.country}:${city.value}`}
                  label={`${countries.find((country) => country.value === city.country)?.label ?? city.country} - ${getCountryCurrency(city.country)}`}
                  value={city.value}
                />
              ))}
            </datalist>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">País</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-slate-50 px-3 text-base text-slate-950 outline-none"
              disabled
              value={settings.country}
            >
              {countries.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label} ({country.currency})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Moneda base
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-slate-50 px-3 text-base text-slate-950 outline-none"
              disabled
              value={settings.defaultCurrency}
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Moneda secundaria
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                updateLocalSettings({
                  secondaryCurrency: event.target.value as CurrencyCode,
                })
              }
              value={settings.secondaryCurrency}
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            Porcentaje base de ganancia
          </span>
          <div className="flex items-center gap-3">
            <input
              className="h-11 w-28 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              max={100}
              min={0}
              onChange={(event) =>
                updateLocalSettings({
                  incomePercentage: Number(event.target.value),
                })
              }
              type="number"
              value={settings.incomePercentage}
            />
            <span className="text-sm font-medium text-slate-500">%</span>
          </div>
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-slate-700">
            Modo tasas
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {rateModes.map((rateMode) => (
              <label
                className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700"
                key={rateMode.value}
              >
                <input
                  checked={settings.rateMode === rateMode.value}
                  className="size-4 accent-emerald-700"
                  onChange={() =>
                    updateLocalSettings({ rateMode: rateMode.value })
                  }
                  type="radio"
                />
                {rateMode.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Tema</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) =>
              updateLocalSettings({ theme: event.target.value as ThemeMode })
            }
            value={settings.theme}
          >
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-slate-500" role="status">
            {saveStatus === 'saved' && 'Guardado'}
            {saveStatus === 'error' && 'No se pudo guardar'}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={saveStatus === 'saving'}
            type="submit"
          >
            <Save className="size-4" aria-hidden="true" />
            {saveStatus === 'saving' ? 'Guardando' : 'Guardar'}
          </button>
        </div>
      </form>

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handlePinSubmit}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Seguridad
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {settings.pinEnabled
                ? 'PIN activo'
                : 'PIN desactivado'}
            </p>
          </div>
        </div>

        {settings.pinEnabled && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              PIN actual
            </span>
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setCurrentPin)
              }
              pattern="[0-9]*"
              type="password"
              value={currentPin}
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              {settings.pinEnabled ? 'Nuevo PIN' : 'PIN'}
            </span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setNextPin)
              }
              pattern="[0-9]*"
              type="password"
              value={nextPin}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Confirmar PIN
            </span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setConfirmPin)
              }
              pattern="[0-9]*"
              type="password"
              value={confirmPin}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={[
              'min-h-5 text-sm font-medium',
              pinStatus === 'error' ? 'text-red-600' : 'text-slate-500',
            ].join(' ')}
            role="status"
          >
            {pinMessage}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {settings.pinEnabled && (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                disabled={pinStatus === 'saving' || currentPin.length < 4}
                onClick={handleDisablePin}
                type="button"
              >
                <ShieldOff className="size-4" aria-hidden="true" />
                Desactivar
              </button>
            )}

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={pinStatus === 'saving'}
              type="submit"
            >
              <LockKeyhole className="size-4" aria-hidden="true" />
              {pinStatus === 'saving'
                ? 'Guardando'
                : settings.pinEnabled
                  ? 'Cambiar PIN'
                  : 'Activar PIN'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default SettingsPage

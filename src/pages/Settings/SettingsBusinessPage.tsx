import { Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  getSettings,
  updateSettings,
} from '../../services/settingsService'
import { listCityOptions } from '../../services/locationService'
import type {
  AppSettings,
  CountryCode,
  CurrencyCode,
  RateMode,
  UserType,
} from '../../types/settings'
import {
  type CityOption,
  countries,
  currencies,
  fallbackCityOptions,
  getCityOption,
  getCountryCurrency,
} from '../../utils/countries'

const rateModes: Array<{ value: RateMode; label: string }> = [
  { value: 'automatic', label: 'Automático' },
  { value: 'manual', label: 'Manual' },
]

const userTypes: Array<{ value: UserType; label: string; description: string }> = [
  {
    value: 'primary',
    label: 'Principal',
    description: 'Temporadas, ciudad, porcentaje, ingresos, egresos y agenda.',
  },
  {
    value: 'basic',
    label: 'Básico',
    description: 'Solo control simple de ingresos y egresos.',
  },
]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsBusinessPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [cityOptions, setCityOptions] =
    useState<CityOption[]>(fallbackCityOptions)
  const [isLoadingCities, setIsLoadingCities] = useState(true)

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
      const updatedSettings = await updateSettings(
        {
          businessName: settings.businessName.trim(),
          country: settings.country,
          city: settings.city.trim(),
          defaultCurrency: settings.defaultCurrency,
          secondaryCurrency: settings.secondaryCurrency,
          incomePercentage: settings.incomePercentage,
          rateMode: settings.rateMode,
          userType: settings.userType,
        },
      )

      setSettings(updatedSettings)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  function updateLocalSettings(updates: Partial<AppSettings>) {
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

  function handleCountryChange(country: CountryCode) {
    const cityBelongsToCountry = cityOptions.some(
      (cityOption) =>
        cityOption.country === country && cityOption.value === settings?.city,
    )

    updateLocalSettings({
      country,
      city: cityBelongsToCountry ? settings?.city ?? '' : '',
      defaultCurrency:
        getCountryCurrency(country) ?? settings?.defaultCurrency ?? 'EUR',
    })
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
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Negocio y moneda"
        title="Datos generales"
      />

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-3 sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">
              Tipo de usuario
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {userTypes.map((userType) => (
                <label
                  className={[
                    'flex min-h-20 cursor-pointer flex-col justify-center gap-1 rounded-md border px-3 text-sm transition',
                    settings.userType === userType.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                  key={userType.value}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      checked={settings.userType === userType.value}
                      className="size-4 accent-emerald-700"
                      onChange={() => updateLocalSettings({ userType: userType.value })}
                      type="radio"
                    />
                    {userType.label}
                  </span>
                  <span className="pl-6 text-xs text-slate-500">{userType.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

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

          {settings.userType === 'primary' && (
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
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {settings.userType === 'primary' && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">País</span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) =>
                  handleCountryChange(event.target.value as CountryCode)
                }
                value={settings.country}
              >
                {countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label} ({country.currency})
                  </option>
                ))}
              </select>
            </label>
          )}

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

        {settings.userType === 'primary' && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Porcentaje de la temporada activa
            </span>
            <div className="flex items-center gap-3">
              <input
                className="h-11 w-28 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                max={100}
                min={0}
                readOnly
                type="number"
                value={settings.incomePercentage}
              />
              <span className="text-sm font-medium text-slate-500">%</span>
            </div>
            <span className="text-sm text-slate-500">El porcentaje se gestiona desde <Link className="font-semibold text-emerald-700 underline" to="/temporadas">Temporadas</Link>. Si ya hay actividad, crea una nueva temporada para cambiarlo.</span>
          </label>
        )}

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
    </section>
  )
}

export default SettingsBusinessPage

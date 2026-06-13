import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  LayoutDashboard,
  MapPin,
  ReceiptText,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import privateBalanceLogo from '../../assets/private-balance-logo.svg'
import { getSettings, updateSettings } from '../../services/settingsService'
import type { AppSettings, CountryCode } from '../../types/settings'
import { countries, getCountryCurrency } from '../../utils/countries'

const mainActions = [
  {
    label: 'Dashboard',
    title: 'Control general de tu actividad',
    description:
      'Visualiza ingresos, gastos, ganancias y estadísticas clave de forma rápida.',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ingresos',
    title: 'Registro de servicios realizados',
    description:
      'Guarda cada servicio, calcula automáticamente tu ganancia real y convierte valores entre monedas.',
    path: '/income',
    icon: CircleDollarSign,
  },
  {
    label: 'Gastos',
    title: 'Control de egresos',
    description:
      'Registra gastos operativos y realiza seguimiento detallado de tus costos diarios.',
    path: '/expenses',
    icon: ReceiptText,
  },
  {
    label: 'Agenda',
    title: 'Planificación de citas',
    description:
      'Organiza tus compromisos, programa citas y conviértelas fácilmente en servicios completados.',
    path: '/agenda',
    icon: CalendarDays,
  },
  {
    label: 'Reportes',
    title: 'Análisis y exportación',
    description:
      'Genera reportes en PDF o Excel y comparte resúmenes de tu actividad cuando lo necesites.',
    path: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Configuración',
    title: 'Preferencias y seguridad',
    description:
      'Administra moneda base, tasas de cambio, PIN de acceso, tema visual y opciones de respaldo.',
    path: '/settings',
    icon: Settings,
  },
]

const LOCATION_CONTEXT_DISMISSAL_KEY =
  'finance-app:dismissed-location-context'

interface DetectedLocation {
  country: CountryCode
  city: string
}

const timezoneLocationMap: Record<string, DetectedLocation> = {
  'America/Argentina/Buenos_Aires': { country: 'AR', city: 'Buenos Aires' },
  'America/Bogota': { country: 'CO', city: 'Bogotá' },
  'America/Mexico_City': { country: 'MX', city: 'Ciudad de México' },
  'Atlantic/Canary': { country: 'ES', city: 'Las Palmas de Gran Canaria' },
  'Europe/Madrid': { country: 'ES', city: 'Madrid' },
  'Europe/London': { country: 'GB', city: 'Londres' },
}

function getCountryLabel(countryCode: CountryCode) {
  return (
    countries.find((country) => country.value === countryCode)?.label ??
    countryCode
  )
}

function isSupportedCountry(countryCode: string): countryCode is CountryCode {
  return countries.some((country) => country.value === countryCode)
}

function getLocationLabel(countryCode: CountryCode, city?: string) {
  const countryLabel = getCountryLabel(countryCode)
  const normalizedCity = city?.trim()

  return normalizedCity ? `${countryLabel}, ${normalizedCity}` : countryLabel
}

function getDetectedLocation() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneLocation = timezone ? timezoneLocationMap[timezone] : undefined

  if (timezoneLocation) {
    return timezoneLocation
  }

  const browserLanguages =
    navigator.languages.length > 0 ? navigator.languages : [navigator.language]

  for (const language of browserLanguages) {
    const countryCode = language.split('-').at(-1)?.toUpperCase()

    if (countryCode && isSupportedCountry(countryCode)) {
      return { country: countryCode, city: '' }
    }
  }

  return null
}

export function HomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(
    null,
  )

  useEffect(() => {
    let isMounted = true

    getSettings().then((currentSettings) => {
      if (isMounted) {
        setSettings(currentSettings)
        setDetectedLocation(getDetectedLocation())
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const currentLocationKey = settings
    ? `${settings.country}:${settings.city.trim()}`
    : ''
  const detectedLocationKey = detectedLocation
    ? `${detectedLocation.country}:${detectedLocation.city.trim()}`
    : ''
  const hasLocationChange =
    settings &&
    detectedLocation &&
    (detectedLocation.country !== settings.country ||
      (detectedLocation.city.trim() !== '' &&
        detectedLocation.city.trim() !== settings.city.trim()))
  const shouldShowLocationContextAlert =
    hasLocationChange &&
    localStorage.getItem(LOCATION_CONTEXT_DISMISSAL_KEY) !==
      `${currentLocationKey}:${detectedLocationKey}`

  function handleKeepCurrentCountry() {
    if (!settings || !detectedLocation) {
      return
    }

    localStorage.setItem(
      LOCATION_CONTEXT_DISMISSAL_KEY,
      `${currentLocationKey}:${detectedLocationKey}`,
    )
    setDetectedLocation(null)
  }

  async function handleChangeCountry() {
    if (!detectedLocation) {
      return
    }

    const updatedSettings = await updateSettings({
      country: detectedLocation.country,
      city: detectedLocation.city,
      defaultCurrency:
        getCountryCurrency(detectedLocation.country) ?? settings?.defaultCurrency,
    })

    setSettings(updatedSettings)
    setDetectedLocation(null)
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-4xl flex-col justify-center gap-8">
      {shouldShowLocationContextAlert ? (
        <aside
          aria-live="polite"
          className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-slate-950">
                  Se detectó un cambio de ubicación.
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">
                    País actual configurado:
                  </dt>
                  <dd className="font-semibold text-slate-950">
                    {getLocationLabel(settings.country, settings.city)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">
                    País detectado:
                  </dt>
                  <dd className="font-semibold text-slate-950">
                    {getLocationLabel(
                      detectedLocation.country,
                      detectedLocation.city,
                    )}
                  </dd>
                </div>
              </dl>
              <p className="text-sm font-medium text-slate-600">
                ¿Deseas cambiar el contexto de trabajo?
              </p>
              <p className="text-sm leading-5 text-slate-500">
                Los registros anteriores conservarán su país y ciudad. Los
                nuevos se guardarán con el contexto elegido desde ahora.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:min-w-52">
            <button
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              onClick={handleKeepCurrentCountry}
              type="button"
            >
              Mantener {getLocationLabel(settings.country, settings.city)}
            </button>
            <button
              className="h-10 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              onClick={handleChangeCountry}
              type="button"
            >
              Cambiar a{' '}
              {getLocationLabel(detectedLocation.country, detectedLocation.city)}
            </button>
          </div>
        </aside>
      ) : null}

      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <img
          alt="Private Balance"
          className="h-44 w-44 shrink-0 object-contain sm:h-52 sm:w-52"
          src={privateBalanceLogo}
        />
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-sm font-medium text-emerald-700">
            {settings?.businessName
              ? `Bienvenida · ${settings.businessName}`
              : 'Bienvenida'}
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Tu espacio privado de organización
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Lleva el control de tu actividad diaria, tus finanzas y tu agenda de
            forma sencilla, segura y totalmente privada.
          </p>
        </div>
      </header>

      <nav aria-label="Accesos principales">
        <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mainActions.map(({ label, title, description, path, icon: Icon }) => (
            <li className="h-full" key={path}>
              <Link
                className="flex h-full min-h-44 items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                to={path}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-lg font-semibold text-slate-950">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {title}
                  </span>
                  <span className="text-sm leading-5 text-slate-500">
                    {description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}

export default HomePage

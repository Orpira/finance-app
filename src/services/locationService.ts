import type { CountryCode } from '../types/settings'
import {
  countries,
  type CityOption,
  fallbackCityOptions,
} from '../utils/countries'

const COUNTRIES_NOW_CITIES_URL =
  'https://countriesnow.space/api/v0.1/countries'

interface CountriesNowCountry {
  country: string
  iso2: string
  iso3: string
  cities: string[]
}

interface CountriesNowCitiesResponse {
  error: boolean
  msg: string
  data: CountriesNowCountry[]
}

const supportedCountryCodes = new Set<string>(
  countries.map((country) => country.value),
)

function isSupportedCountryCode(countryCode: string): countryCode is CountryCode {
  return supportedCountryCodes.has(countryCode)
}

function normalizeCityOptions(data: CountriesNowCountry[]): CityOption[] {
  const uniqueOptions = new Map<string, CityOption>()

  data.forEach((country) => {
    const countryCode = country.iso2?.toUpperCase()

    if (!isSupportedCountryCode(countryCode)) {
      return
    }

    country.cities.forEach((city) => {
      const normalizedCity = city.trim()

      if (!normalizedCity) {
        return
      }

      uniqueOptions.set(`${countryCode}:${normalizedCity}`, {
        value: normalizedCity,
        label: normalizedCity,
        country: countryCode,
      })
    })
  })

  return Array.from(uniqueOptions.values()).sort((firstCity, secondCity) =>
    firstCity.label.localeCompare(secondCity.label, 'es'),
  )
}

function mergeCityOptions(...optionGroups: CityOption[][]) {
  const uniqueOptions = new Map<string, CityOption>()

  optionGroups.flat().forEach((city) => {
    uniqueOptions.set(`${city.country}:${city.value}`, city)
  })

  return Array.from(uniqueOptions.values()).sort((firstCity, secondCity) =>
    firstCity.label.localeCompare(secondCity.label, 'es'),
  )
}

export async function listCityOptions() {
  try {
    const response = await fetch(COUNTRIES_NOW_CITIES_URL)

    if (!response.ok) {
      throw new Error('No se pudo cargar la lista de ciudades.')
    }

    const payload = (await response.json()) as CountriesNowCitiesResponse

    if (payload.error || !Array.isArray(payload.data)) {
      throw new Error(payload.msg || 'La respuesta de ciudades no es válida.')
    }

    const cityOptions = mergeCityOptions(
      fallbackCityOptions,
      normalizeCityOptions(payload.data),
    )

    return cityOptions.length > 0 ? cityOptions : fallbackCityOptions
  } catch {
    return fallbackCityOptions
  }
}

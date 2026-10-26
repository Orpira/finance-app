import type { CountryCode, CurrencyCode } from '../types/settings'
import { normalizeCityName } from '../utils/cityNormalization'
import {
  fallbackCityOptions,
  getCityOption,
  getCountryCurrency,
  type CityOption,
} from '../utils/countries'

export interface ResolvedCityOption extends CityOption {
  currency: CurrencyCode
}

function resolveOptionCurrency(
  cityOption: CityOption,
): ResolvedCityOption | undefined {
  const currency = getCountryCurrency(cityOption.country)

  return currency ? { ...cityOption, currency } : undefined
}

export async function listCityOptions() {
  return fallbackCityOptions
}

export async function resolveCityOption(
  city: string,
  preferredCountry?: CountryCode,
): Promise<ResolvedCityOption | undefined> {
  const normalizedCity = normalizeCityName(city)

  if (!normalizedCity) {
    return undefined
  }

  const localOption = getCityOption(city, fallbackCityOptions)

  if (localOption) {
    return resolveOptionCurrency(localOption)
  }

  const { cityCountryIndex } = await import('../data/cityCountryIndex')
  const countryCandidates = cityCountryIndex[normalizedCity]

  if (!countryCandidates || countryCandidates.length === 0) {
    return undefined
  }

  const country =
    preferredCountry && countryCandidates.includes(preferredCountry)
      ? preferredCountry
      : countryCandidates[0]

  return resolveOptionCurrency({
    value: city.trim(),
    label: city.trim(),
    country,
  })
}

import type { CountryCode, CurrencyCode } from '../types/settings'

export interface CountryOption {
  value: CountryCode
  label: string
  currency: CurrencyCode
}

export interface CurrencyOption {
  value: CurrencyCode
  label: string
}

export const currencies: CurrencyOption[] = [
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Libra esterlina' },
  { value: 'BGN', label: 'BGN - Lev búlgaro' },
  { value: 'CZK', label: 'CZK - Corona checa' },
  { value: 'DKK', label: 'DKK - Corona danesa' },
  { value: 'HUF', label: 'HUF - Florín húngaro' },
  { value: 'PLN', label: 'PLN - Zloty polaco' },
  { value: 'RON', label: 'RON - Leu rumano' },
  { value: 'SEK', label: 'SEK - Corona sueca' },
  { value: 'COP', label: 'COP - Peso colombiano' },
  { value: 'USD', label: 'USD - Dólar estadounidense' },
]

export const countries: CountryOption[] = [
  { value: 'DE', label: 'Alemania', currency: 'EUR' },
  { value: 'AT', label: 'Austria', currency: 'EUR' },
  { value: 'BE', label: 'Bélgica', currency: 'EUR' },
  { value: 'BG', label: 'Bulgaria', currency: 'BGN' },
  { value: 'CY', label: 'Chipre', currency: 'EUR' },
  { value: 'HR', label: 'Croacia', currency: 'EUR' },
  { value: 'DK', label: 'Dinamarca', currency: 'DKK' },
  { value: 'SK', label: 'Eslovaquia', currency: 'EUR' },
  { value: 'SI', label: 'Eslovenia', currency: 'EUR' },
  { value: 'ES', label: 'España', currency: 'EUR' },
  { value: 'EE', label: 'Estonia', currency: 'EUR' },
  { value: 'FI', label: 'Finlandia', currency: 'EUR' },
  { value: 'FR', label: 'Francia', currency: 'EUR' },
  { value: 'GR', label: 'Grecia', currency: 'EUR' },
  { value: 'HU', label: 'Hungría', currency: 'HUF' },
  { value: 'IE', label: 'Irlanda', currency: 'EUR' },
  { value: 'IT', label: 'Italia', currency: 'EUR' },
  { value: 'LV', label: 'Letonia', currency: 'EUR' },
  { value: 'LT', label: 'Lituania', currency: 'EUR' },
  { value: 'LU', label: 'Luxemburgo', currency: 'EUR' },
  { value: 'MT', label: 'Malta', currency: 'EUR' },
  { value: 'NL', label: 'Países Bajos', currency: 'EUR' },
  { value: 'PL', label: 'Polonia', currency: 'PLN' },
  { value: 'PT', label: 'Portugal', currency: 'EUR' },
  { value: 'CZ', label: 'República Checa', currency: 'CZK' },
  { value: 'RO', label: 'Rumanía', currency: 'RON' },
  { value: 'SE', label: 'Suecia', currency: 'SEK' },
  { value: 'GB', label: 'Reino Unido', currency: 'GBP' },
  { value: 'CO', label: 'Colombia', currency: 'COP' },
]

export function getCountryCurrency(countryCode: CountryCode) {
  return countries.find((country) => country.value === countryCode)?.currency
}

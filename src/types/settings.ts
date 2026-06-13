export type CurrencyCode =
  | 'ARS'
  | 'BGN'
  | 'COP'
  | 'CZK'
  | 'DKK'
  | 'EUR'
  | 'GBP'
  | 'HUF'
  | 'MXN'
  | 'PLN'
  | 'RON'
  | 'SEK'
  | 'USD'
export type CountryCode =
  | 'AR'
  | 'AT'
  | 'BE'
  | 'BG'
  | 'CO'
  | 'CY'
  | 'CZ'
  | 'DE'
  | 'DK'
  | 'EE'
  | 'ES'
  | 'FI'
  | 'FR'
  | 'GB'
  | 'GR'
  | 'HR'
  | 'HU'
  | 'IE'
  | 'IT'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'MT'
  | 'MX'
  | 'NL'
  | 'PL'
  | 'PT'
  | 'RO'
  | 'SE'
  | 'SI'
  | 'SK'
export type RateMode = 'automatic' | 'manual'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface AppSettings {
  id: 'app'
  businessName: string
  country: CountryCode
  city: string
  defaultCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode
  incomePercentage: number
  rateMode: RateMode
  theme: ThemeMode
  pinEnabled: boolean
  pinHash?: string
  createdAt: string
  updatedAt: string
}

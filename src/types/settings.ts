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
export type UserType = 'primary' | 'basic'
export type BackupFrequency = 'daily'
export type CutoffFrequency = 'weekly' | 'biweekly' | 'monthly'
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ClosedLocationSeason {
  city: string
  closedAt: string
  country: CountryCode
}

export interface ReopenedLocationSeason extends ClosedLocationSeason {
  reopenedAt: string
}

export interface AppSettings {
  id: 'app'
  businessName: string
  country: CountryCode
  city: string
  defaultCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode
  incomePercentage: number
  rateMode: RateMode
  userType: UserType
  theme: ThemeMode
  pinEnabled: boolean
  pinHash?: string
  backupEncryptionKey: string
  driveBackupEnabled: boolean
  driveBackupFrequency: BackupFrequency
  cutoffFrequency: CutoffFrequency
  cutoffWeekStart: WeekStartDay
  cutoffAnchorDate: string
  googleDriveClientId: string
  googleDriveConnected: boolean
  googleDriveLastBackupAt?: string
  googleDriveLastBackupStatus?: string
  closedLocationSeasons: ClosedLocationSeason[]
  reopenedLocationSeasons: ReopenedLocationSeason[]
  createdAt: string
  updatedAt: string
}

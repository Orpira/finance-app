export type LicenseStatus = 'inactive' | 'active' | 'expired'
export type LicenseType = 'demo' | 'monthly' | 'annual' | 'lifetime'

export interface AppLicense {
  id: string
  deviceCode: string
  activationCode?: string
  activationDate?: string
  expirationDate?: string
  status: LicenseStatus
  licenseType: LicenseType
  licenseVersion: 1 | 2
  lastValidAccessDate?: string
  createdAt: string
  updatedAt: string
}

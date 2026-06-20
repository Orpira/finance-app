export type LicenseStatus = 'inactive' | 'active' | 'expired'
export type LicenseType = 'demo' | 'monthly' | 'annual' | 'lifetime'

export interface AppLicense {
  id: 'current'
  deviceCode: string
  activationCode?: string
  activationDate?: string
  expirationDate?: string
  status: LicenseStatus
  licenseType: LicenseType
  lastValidAccessDate?: string
  createdAt: string
  updatedAt: string
}

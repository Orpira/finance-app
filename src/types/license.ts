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
  licenseKey?: string
  userCode?: string
  deviceName?: string
  platform?: 'web' | 'android' | 'ios' | 'unknown'
  deviceAuthorization?: 'existing' | 'registered'
  activeDevices?: number
  maxDevices?: number
  lastValidAccessDate?: string
  createdAt: string
  updatedAt: string
}

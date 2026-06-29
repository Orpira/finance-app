export type DeviceIdentityPlatform = 'web' | 'android' | 'ios' | 'unknown'

export type DeviceProvisioningStatus = 'pending' | 'provisioned' | 'error'

export interface DeviceIdentity {
  id: 'current'
  userCode: string
  deviceCode: string
  deviceName?: string
  platform: DeviceIdentityPlatform
  appVersion?: string
  provisioningStatus?: DeviceProvisioningStatus
  provisionedAt?: string
  lastProvisioningError?: string
  createdAt: string
  updatedAt: string
}

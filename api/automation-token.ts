/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import {
  getSignedLicenseKey,
  issueAutomationJwt,
  verifySignedLicenseForDevice,
} from '../server/automationSecurity.js'
import {
  authorizeLicenseDevice,
  LicenseRegistryError,
} from '../server/licenseDeviceRegistry.js'

const requestSchema = z.object({
  activationCode: z.string().min(20).max(4096),
  deviceCode: z.union([
    z.string().regex(/^PB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/),
    z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ]),
  userCode: z.string().min(1).max(100),
  deviceName: z.string().max(200).optional(),
  platform: z.enum(['web', 'android', 'ios', 'unknown']).optional(),
}).strict()

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (rejectInvalidRequest(request, response, 8 * 1024)) return

  try {
    const input = requestSchema.parse(request.body)
    const license = verifySignedLicenseForDevice(
      input.activationCode,
      input.deviceCode,
    )
    await authorizeLicenseDevice({
      licenseKey: getSignedLicenseKey(input.activationCode),
      userCode: input.userCode,
      deviceCode: input.deviceCode,
      deviceName: input.deviceName,
      platform: input.platform,
      licenseType: license.licenseType,
      expiresAt: license.expiresAt,
      devicePolicy: license.devicePolicy ?? 'multi',
    })
    const jwt = issueAutomationJwt(
      input.deviceCode,
      license.licenseType,
      license.expiresAt,
    )

    response.status(200).json(jwt)
  } catch (error) {
    if (error instanceof LicenseRegistryError) {
      const status = error.code === 'device-limit-reached' ? 409 : 403
      response.status(status).json({ error: error.message })
      return
    }
    response.status(401).json({ error: 'No se pudo autorizar este dispositivo.' })
  }
}

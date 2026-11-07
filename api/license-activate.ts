/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import {
  getSignedLicenseKey,
  verifySignedLicenseForDevice,
} from '../server/automationSecurity.js'
import {
  authorizeLicenseDevice,
  getDeviceAccessPermit,
  LicenseRegistryError,
} from '../server/licenseDeviceRegistry.js'

const requestSchema = z.object({
  activationCode: z.string().min(20).max(4096),
  userCode: z.string().min(1).max(100),
  deviceCode: z.union([
    z.string().regex(/^PB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/),
    z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ]),
  deviceName: z.string().max(200).optional(),
  renewAccess: z.literal(true).optional(),
  platform: z.enum(['web', 'android', 'ios', 'unknown']),
}).strict()

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (rejectInvalidRequest(request, response, 8 * 1024)) return

  let validated = false
  try {
    const input = requestSchema.parse(request.body)
    const license = verifySignedLicenseForDevice(
      input.activationCode,
      input.deviceCode,
    )
    validated = true
    const authorization = await authorizeLicenseDevice({
      licenseKey: getSignedLicenseKey(input.activationCode),
      userCode: input.userCode,
      deviceCode: input.deviceCode,
      deviceName: input.deviceName,
      platform: input.platform,
      licenseType: license.licenseType,
      expiresAt: license.expiresAt,
      devicePolicy: license.devicePolicy ?? 'multi',
    })

    const permit = input.renewAccess
      ? await getDeviceAccessPermit(authorization.licenseKey, input.deviceCode)
      : undefined
    response.status(200).json({ ...authorization, ...permit })
  } catch (error) {
    if (error instanceof LicenseRegistryError) {
      const status = error.code === 'database-unavailable'
        ? 503
        : error.code === 'device-limit-reached' ? 409 : 403
      response.status(status).json({ error: error.message, code: error.code })
      return
    }

    if (validated) {
      response.status(503).json({ error: 'El registro de licencias no está disponible.' })
      return
    }

    response.status(401).json({
      error: error instanceof Error
        ? error.message
        : 'No se pudo validar la licencia.',
    })
  }
}

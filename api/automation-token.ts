/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import {
  issueAutomationJwt,
  verifySignedLicenseForDevice,
} from '../server/automationSecurity.js'

const requestSchema = z.object({
  activationCode: z.string().min(20).max(4096),
  deviceCode: z.string().regex(/^PB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/),
}).strict()

export default function handler(
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
    const jwt = issueAutomationJwt(
      input.deviceCode,
      license.licenseType,
      license.expiresAt,
    )

    response.status(200).json(jwt)
  } catch {
    response.status(401).json({ error: 'No se pudo autorizar este dispositivo.' })
  }
}

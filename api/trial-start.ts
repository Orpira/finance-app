/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import { LicenseRegistryError } from '../server/licenseDeviceRegistry.js'
import { neonTrialGrantsRepository } from '../server/neonTrialGrantsRepository.js'
import {
  ClockTamperedError,
  issueOrReactivateTrial,
  TrialExpiredError,
  type TrialIssueInput,
} from '../server/trialLicenseService.js'

const requestSchema = z.object({
  deviceCode: z.union([
    z.string().regex(/^PB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/),
    z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ]),
  userCode: z.string().min(1).max(100),
  platform: z.enum(['web', 'android', 'ios', 'unknown']),
}).strict()

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Cuerpo pequeño: esta solicitud no lleva ningún código de activación,
  // solo identificadores ya generados en el propio dispositivo.
  if (rejectInvalidRequest(request, response, 2 * 1024)) return

  try {
    const input = requestSchema.parse(request.body) as TrialIssueInput
    const result = await issueOrReactivateTrial(input, neonTrialGrantsRepository)

    response.status(200).json(result)
  } catch (error) {
    if (error instanceof TrialExpiredError) {
      response.status(409).json({ outcome: 'expired', error: error.message })
      return
    }

    if (error instanceof ClockTamperedError) {
      response.status(409).json({ outcome: 'clock-tampered', error: error.message })
      return
    }

    if (error instanceof LicenseRegistryError) {
      const status = error.code === 'device-limit-reached' ? 409 : 403
      response.status(status).json({ error: error.message })
      return
    }

    response.status(400).json({
      error: error instanceof Error
        ? error.message
        : 'No se pudo iniciar la prueba gratuita.',
    })
  }
}

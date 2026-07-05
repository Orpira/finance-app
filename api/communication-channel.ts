/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import { verifyAutomationJwt } from '../server/automationSecurity.js'
import {
  getCommunicationChannel,
} from '../server/communicationChannelStore.js'

const userCodeHeaderSchema = z.string().min(1)

function getUserCode(request: VercelRequest) {
  const headerValue = request.headers['x-private-balance-user-code']
  const parsed = userCodeHeaderSchema.safeParse(headerValue)
  if (!parsed.success) {
    throw new Error('Falta el encabezado X-Private-Balance-User-Code.')
  }
  return parsed.data
}

function mapChannelToResponse(channel: Awaited<ReturnType<typeof getCommunicationChannel>>) {
  if (!channel) return null

  return {
    id: channel.id,
    userCode: channel.userCode,
    deviceCode: channel.deviceCode,
    provider: channel.provider,
    instanceName: channel.instanceName,
    instanceId: channel.instanceId,
    phoneNumber: channel.phoneNumber,
    ownerJid: channel.ownerJid,
    profileName: channel.profileName,
    profilePhoto: channel.profilePhoto,
    status: channel.status,
    pairingCode: channel.pairingCode,
    providerMetadata: channel.providerMetadata,
    connectedAt: channel.connectedAt,
    lastSeenAt: channel.lastSeenAt,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 0, {
    allowedMethods: ['GET'],
    requireJsonContentType: false,
  })) return

  try {
    const claims = verifyAutomationJwt(extractBearer(request))
    const userCode = getUserCode(request)
    const channel = await getCommunicationChannel(userCode, claims.sub)
    response.status(200).json({ channel: mapChannelToResponse(channel) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo obtener el canal.'
    const status = message.includes('encabezado') ? 400 : message.includes('JWT') ? 401 : 500
    response.status(status).json({ error: message })
  }
}

function extractBearer(request: VercelRequest) {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new Error('Autorización ausente.')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new Error('Autorización ausente.')
  return token
}

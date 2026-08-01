import { getLastInboundAt, setLastInboundAt } from '../repositories/serviceWindowRepository.js'

/** Ventana de servicio al cliente de WhatsApp Cloud API: 24 horas desde el último mensaje entrante. */
const SERVICE_WINDOW_DURATION_MS = 24 * 60 * 60 * 1000

export interface ServiceWindowStatus {
  open: boolean
  lastInboundAt?: string
  expiresAt?: string
}

export async function getStatus(contactReference: string): Promise<ServiceWindowStatus> {
  const lastInboundAt = await getLastInboundAt(contactReference)
  if (!lastInboundAt) return { open: false }

  const expiresAt = new Date(new Date(lastInboundAt).getTime() + SERVICE_WINDOW_DURATION_MS)
  return {
    open: expiresAt.getTime() > Date.now(),
    lastInboundAt,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function registerInbound(contactReference: string, timestamp: string): Promise<void> {
  await setLastInboundAt(contactReference, timestamp)
}

import type { AssistantProposalKind } from './assistantProposalContracts'

function secureRandomToken() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('ASSISTANT_PROPOSAL_ID_UNAVAILABLE')
  }
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

/** Crea un ID nuevo; editar, confirmar o reintentar conserva el ya asignado. */
export function createAssistantProposalId(
  kind: AssistantProposalKind,
  timestamp = Date.now(),
) {
  return `assistant-proposal:${kind}:${timestamp}:${secureRandomToken()}`
}

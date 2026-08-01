import type { CurrencyCode, UsageMode } from '../../types/settings'
import { parseAssistantIntent } from './assistantIntentParser'
import { createProposalFromParsedIntent } from './assistantProposalFactory'
import {
  buildAssistantPrivacyAuthorizationRequest,
  buildAssistantPrivacyContext,
} from './assistantPrivacyContext'
import { recordPrivacyAuthorization } from './assistantPrivacyInspector'
import { createAIPrivacyBoundary } from '../ai-foundation/aiPrivacyBoundary'
import type { AssistantProposalRecord } from './assistantProposalContracts'

export type AssistantInterpretationResult =
  | { readonly kind: 'proposal'; readonly proposal: AssistantProposalRecord }
  | { readonly kind: 'no-action' }
  | { readonly kind: 'privacy-denied'; readonly safeMessage: string }

let requestSequence = 0

/**
 * Punto de entrada del flujo Usuario → Interpretación → Propuesta: conecta
 * el parser determinista (intents), el Context Builder + la frontera de
 * privacidad 8A (privacy) y la fábrica de propuestas (proposals). Nunca
 * llama a un servicio de escritura — eso solo ocurre tras confirmación
 * explícita, en assistantExecutionService.ts.
 */
export function interpretAssistantMessage(
  text: string,
  context: { readonly defaultCurrency: CurrencyCode; readonly usageMode: UsageMode; readonly now?: Date },
): AssistantInterpretationResult {
  const parsed = parseAssistantIntent(text, { ...(context.now ? { now: context.now } : {}) })
  if (parsed.kind === 'none') {
    return { kind: 'no-action' }
  }

  requestSequence += 1
  const requestId = `assistant-privacy:${Date.now()}:${requestSequence}`

  const privacyContext = buildAssistantPrivacyContext({
    currency: context.defaultCurrency,
    usageMode: context.usageMode,
  })
  const authorizationRequest = buildAssistantPrivacyAuthorizationRequest(privacyContext, { requestId })
  const boundary = createAIPrivacyBoundary()
  const authorizationResult = boundary.authorize(authorizationRequest)
  recordPrivacyAuthorization(requestId, authorizationResult)

  if (!authorizationResult.ok) {
    return {
      kind: 'privacy-denied',
      safeMessage: 'No se pudo preparar el contexto de forma segura para interpretar tu mensaje.',
    }
  }

  const proposal = createProposalFromParsedIntent(parsed, {
    defaultCurrency: context.defaultCurrency,
  })

  if (proposal === null) {
    return { kind: 'no-action' }
  }

  return { kind: 'proposal', proposal }
}

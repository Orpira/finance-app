import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
} from '../../intent-resolver/intentResolver'
import {
  validateAIProviderIntentResolutionResult,
} from '../../ai-provider/aiProviderValidator'
import {
  ACTIVATION_ENGINE_PROTOCOL_VERSION,
  type ActivationDecision,
  type ActivationDecisionInput,
  type ActivationEngine,
  type ActivationEngineDependencies,
} from './activationContracts'
import {
  createNoopActivationMetricsRecorder,
} from './activationMetrics'
import {
  validateActivationPolicy,
  validateActivationRoutingStrategy,
} from './activationValidator'

function detectExplanationIntent(message: string): boolean {
  const normalized = message.toLowerCase()
  return /explica|expli|analiza|interpreta|porque|por que|why|explain/.test(normalized)
}

function buildInvalidRequestDecision(provider: string, reason: string): ActivationDecision {
  return {
    protocolVersion: ACTIVATION_ENGINE_PROTOCOL_VERSION,
    activationType: 'INVALID_REQUEST',
    provider,
    toolId: null,
    confidence: 0,
    requiresAI: false,
    requiresTool: false,
    requiresExplanation: false,
    fallback: {
      used: false,
    },
    reason,
    intent: 'unknown',
  }
}

function buildFallbackDecision(
  provider: string,
  reason: string,
  confidence: number,
  toolId: string | null,
  intent: string,
): ActivationDecision {
  return {
    protocolVersion: ACTIVATION_ENGINE_PROTOCOL_VERSION,
    activationType: 'FALLBACK',
    provider,
    toolId,
    confidence,
    requiresAI: true,
    requiresTool: toolId !== null,
    requiresExplanation: true,
    fallback: {
      used: true,
      reason,
    },
    reason,
    intent,
  }
}

export function createActivationEngine(
  dependencies: ActivationEngineDependencies,
): ActivationEngine {
  const metrics = dependencies.metrics ?? createNoopActivationMetricsRecorder()
  const now = dependencies.now ?? (() => new Date().toISOString())
  const clock = dependencies.clock ?? (() => Date.now())

  const policyValidation = validateActivationPolicy(dependencies.policy)
  if (policyValidation !== null) {
    throw new Error(policyValidation.safeMessage)
  }

  const routingValidation = validateActivationRoutingStrategy(dependencies.routingStrategy)
  if (routingValidation !== null) {
    throw new Error(routingValidation.safeMessage)
  }

  return {
    async decide(input: ActivationDecisionInput): Promise<ActivationDecision> {
      const startedAt = clock()

      const trimmedMessage = input.userMessage.trim()
      if (trimmedMessage.length === 0) {
        const decision = buildInvalidRequestDecision(
          dependencies.primaryProviderId,
          'The request is invalid because userMessage is empty.',
        )

        metrics.record({
          activationType: decision.activationType,
          provider: decision.provider,
          toolId: decision.toolId,
          confidence: decision.confidence,
          decisionDurationMs: clock() - startedAt,
          fallbackUsed: false,
          success: false,
          errorCode: 'INVALID_REQUEST',
        })

        return decision
      }

      const primaryResolver = dependencies.primaryIntentResolver
      if (primaryResolver === undefined) {
        const decision = buildFallbackDecision(
          dependencies.fallbackProviderId,
          'Primary provider intent resolver is unavailable.',
          0,
          null,
          'unknown',
        )

        metrics.record({
          activationType: decision.activationType,
          provider: decision.provider,
          toolId: decision.toolId,
          confidence: decision.confidence,
          decisionDurationMs: clock() - startedAt,
          fallbackUsed: true,
          success: dependencies.policy.enableFallback,
          errorCode: dependencies.policy.enableFallback ? undefined : 'PROVIDER_UNAVAILABLE',
        })

        return dependencies.policy.enableFallback
          ? decision
          : buildInvalidRequestDecision(
              dependencies.primaryProviderId,
              'Primary provider is unavailable and fallback is disabled.',
            )
      }

      const primaryResult = await primaryResolver({
        protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
        conversationRequest: input.conversationRequest,
        metadata: {
          userMessage: input.userMessage,
          turn: input.turn,
          requestedAt: input.requestedAt ?? now(),
        },
      }).catch(() => {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: 'Primary intent resolver failed.',
        } as const
      })

      const primaryValidation = validateAIProviderIntentResolutionResult(primaryResult)
      const primarySuccess = primaryValidation === null && primaryResult.kind === 'success'
      const confidence = primarySuccess ? primaryResult.resolution.confidence : 0
      const lowConfidence = primarySuccess && confidence < dependencies.policy.minimumConfidence

      if (!primarySuccess || lowConfidence) {
        if (!dependencies.policy.enableFallback || dependencies.fallbackIntentResolver === undefined) {
          const decision = buildInvalidRequestDecision(
            dependencies.primaryProviderId,
            !primarySuccess
              ? 'Primary intent resolution failed and fallback is unavailable.'
              : 'Primary confidence is below threshold and fallback is disabled.',
          )

          metrics.record({
            activationType: decision.activationType,
            provider: decision.provider,
            toolId: decision.toolId,
            confidence,
            decisionDurationMs: clock() - startedAt,
            fallbackUsed: false,
            success: false,
            errorCode: 'INVALID_REQUEST',
          })

          return decision
        }

        const fallbackResult = await dependencies.fallbackIntentResolver({
          protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
          conversationRequest: input.conversationRequest,
          metadata: {
            userMessage: input.userMessage,
            turn: input.turn,
            requestedAt: input.requestedAt ?? now(),
          },
        }).catch(() => {
          return {
            kind: 'failure',
            code: 'INTENT_RESOLUTION_FAILED',
            retryable: false,
            safeMessage: 'Fallback intent resolver failed.',
          } as const
        })

        const fallbackValidation = validateAIProviderIntentResolutionResult(fallbackResult)
        if (fallbackValidation !== null || fallbackResult.kind === 'failure') {
          const decision = buildFallbackDecision(
            dependencies.fallbackProviderId,
            'Fallback resolution failed after primary resolution failure.',
            confidence,
            null,
            'unknown',
          )

          metrics.record({
            activationType: decision.activationType,
            provider: decision.provider,
            toolId: decision.toolId,
            confidence: decision.confidence,
            decisionDurationMs: clock() - startedAt,
            fallbackUsed: true,
            success: false,
            errorCode: 'FALLBACK_FAILED',
          })

          return decision
        }

        const fallbackTool = fallbackResult.resolution.tools[0]
        const fallbackDecision = buildFallbackDecision(
          dependencies.fallbackProviderId,
          'Fallback activated due to primary resolution failure or low confidence.',
          fallbackResult.resolution.confidence,
          fallbackTool?.toolId ?? null,
          fallbackResult.resolution.detectedIntent,
        )

        metrics.record({
          activationType: fallbackDecision.activationType,
          provider: fallbackDecision.provider,
          toolId: fallbackDecision.toolId,
          confidence: fallbackDecision.confidence,
          decisionDurationMs: clock() - startedAt,
          fallbackUsed: true,
          success: true,
        })

        return {
          ...fallbackDecision,
          ...(fallbackTool?.arguments === undefined
            ? {}
            : { toolArguments: structuredClone(fallbackTool.arguments) }),
        }
      }

      const selectedTool = primaryResult.resolution.tools[0]
      const toolId = selectedTool?.toolId ?? null
      const toolExists = toolId !== null && dependencies.routingStrategy.exists(toolId)
      const requiresExplanation = dependencies.policy.enableAIExplanation && detectExplanationIntent(trimmedMessage)

      const activationType: ActivationDecision['activationType'] =
        toolExists && dependencies.policy.enableDirectTools
          ? (requiresExplanation ? 'TOOL_WITH_AI' : 'DIRECT_TOOL')
          : 'DIRECT_AI'

      const requiresTool = activationType !== 'DIRECT_AI'
      const requiresAI = activationType !== 'DIRECT_TOOL'

      const decision: ActivationDecision = {
        protocolVersion: ACTIVATION_ENGINE_PROTOCOL_VERSION,
        activationType,
        provider: dependencies.primaryProviderId,
        toolId: requiresTool ? toolId : null,
        confidence: primaryResult.resolution.confidence,
        requiresAI,
        requiresTool,
        requiresExplanation,
        fallback: {
          used: false,
        },
        reason: toolExists
          ? 'Tool and intent resolution are available for deterministic routing.'
          : 'No specialized tool was resolved; route to AI generation.',
        intent: primaryResult.resolution.detectedIntent,
        ...(selectedTool?.arguments === undefined
          ? {}
          : { toolArguments: structuredClone(selectedTool.arguments) }),
      }

      metrics.record({
        activationType: decision.activationType,
        provider: decision.provider,
        toolId: decision.toolId,
        confidence: decision.confidence,
        decisionDurationMs: clock() - startedAt,
        fallbackUsed: decision.fallback.used,
        success: true,
      })

      return decision
    },
  }
}

import type {
  AIConversationRequest,
} from '../aiConversationFacadeContracts'
import type {
  IntentResolverProvider,
} from '../../ai-provider/aiProviderContracts'
import type {
  AIToolJsonValue,
} from '../../ai-tools'

export const ACTIVATION_ENGINE_PROTOCOL_VERSION = 1 as const

export const ACTIVATION_TYPES = [
  'DIRECT_TOOL',
  'DIRECT_AI',
  'TOOL_WITH_AI',
  'FALLBACK',
  'INVALID_REQUEST',
] as const

export type ActivationType = (typeof ACTIVATION_TYPES)[number]

export interface ActivationFallback {
  readonly used: boolean
  readonly reason?: string
}

export interface ActivationDecision {
  readonly protocolVersion: typeof ACTIVATION_ENGINE_PROTOCOL_VERSION
  readonly activationType: ActivationType
  readonly provider: string
  readonly toolId: string | null
  readonly confidence: number
  readonly requiresAI: boolean
  readonly requiresTool: boolean
  readonly requiresExplanation: boolean
  readonly fallback: ActivationFallback
  readonly reason: string
  readonly intent: string
  readonly toolArguments?: Readonly<Record<string, AIToolJsonValue>>
}

export interface ActivationPolicy {
  readonly minimumConfidence: number
  readonly enableFallback: boolean
  readonly enableAIExplanation: boolean
  readonly enableDirectTools: boolean
}

export interface ActivationRoutingStrategy {
  exists(toolId: string): boolean
}

export interface ActivationMetricsRecorder {
  record(entry: {
    readonly activationType: ActivationType
    readonly provider: string
    readonly toolId: string | null
    readonly confidence: number
    readonly decisionDurationMs: number
    readonly fallbackUsed: boolean
    readonly success: boolean
    readonly errorCode?: string
  }): void
}

export interface ActivationDecisionInput {
  readonly conversationRequest: AIConversationRequest
  readonly userMessage: string
  readonly turn: number
  readonly requestedAt?: string
}

export interface ActivationEngineDependencies {
  readonly primaryProviderId: string
  readonly fallbackProviderId: string
  readonly primaryIntentResolver?: IntentResolverProvider['resolveIntent']
  readonly fallbackIntentResolver?: IntentResolverProvider['resolveIntent']
  readonly policy: ActivationPolicy
  readonly routingStrategy: ActivationRoutingStrategy
  readonly metrics?: ActivationMetricsRecorder
  readonly now?: () => string
  readonly clock?: () => number
}

export interface ActivationEngine {
  decide(input: ActivationDecisionInput): Promise<ActivationDecision>
}

import type {
  AIPrivacyAuthorizationRequest,
  AIPrivacyAuthorizationResult,
  AIPrivacyPolicy,
} from './aiFoundationContracts'

export interface AIPrivacyBoundaryDependencies {
  readonly defaultPolicy?: AIPrivacyPolicy
}

export interface AIPrivacyBoundaryPort {
  authorize(
    request: AIPrivacyAuthorizationRequest | null | undefined,
  ): AIPrivacyAuthorizationResult
}

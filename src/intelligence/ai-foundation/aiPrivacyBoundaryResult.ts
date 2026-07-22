import type {
  AIPrivacyAuthorizationFailure,
  AIPrivacyAuthorizationResult,
  AIPrivacyAuthorizationSuccess,
} from './aiFoundationContracts'

export function isAIPrivacyAuthorizationSuccess(
  result: AIPrivacyAuthorizationResult,
): result is AIPrivacyAuthorizationSuccess {
  return result.ok === true
}

export function isAIPrivacyAuthorizationFailure(
  result: AIPrivacyAuthorizationResult,
): result is AIPrivacyAuthorizationFailure {
  return result.ok === false
}

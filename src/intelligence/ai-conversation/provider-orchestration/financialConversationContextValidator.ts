import {
  FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION,
  type FinancialConversationContext,
  type FinancialMappedToolResult,
  type FinancialToolResultMapper,
} from './financialConversationContext'

export interface FinancialConversationContextValidationFailure {
  readonly kind: 'failure'
  readonly code:
    | 'INVALID_FINANCIAL_CONVERSATION_CONTEXT'
    | 'INVALID_FINANCIAL_TOOL_RESULT_MAPPER'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: FinancialConversationContextValidationFailure['code'],
  safeMessage: string,
): FinancialConversationContextValidationFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateMappedToolResult(
  result: FinancialMappedToolResult,
): FinancialConversationContextValidationFailure | null {
  if (
    !isNonEmptyString(result.stepId)
    || !Number.isSafeInteger(result.order)
    || result.order <= 0
    || !isNonEmptyString(result.toolId)
    || (result.kind !== 'success' && result.kind !== 'failure')
  ) {
    return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool result contract is invalid.')
  }

  if (result.kind === 'success') {
    if (typeof result.durationMs !== 'number' || !Number.isFinite(result.durationMs) || result.durationMs < 0) {
      return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool result duration is invalid.')
    }

    if (!isNonEmptyString(result.permission)) {
      return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool result permission is invalid.')
    }

    if (result.output === null || result.error !== null) {
      return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool success payload is inconsistent.')
    }
  }

  if (result.kind === 'failure') {
    if (result.durationMs !== null || result.permission !== null || result.output !== null) {
      return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool failure payload is inconsistent.')
    }

    if (result.error === null || !isNonEmptyString(result.error.code) || !isNonEmptyString(result.error.safeMessage)) {
      return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The mapped tool failure error is invalid.')
    }
  }

  return null
}

export function validateFinancialToolResultMapper(
  mapper: FinancialToolResultMapper,
): FinancialConversationContextValidationFailure | null {
  if (
    !isNonEmptyString(mapper.mapperId)
    || typeof mapper.map !== 'function'
  ) {
    return createFailure('INVALID_FINANCIAL_TOOL_RESULT_MAPPER', 'The financial tool result mapper contract is invalid.')
  }

  return null
}

export function validateFinancialConversationContext(
  context: FinancialConversationContext,
): FinancialConversationContextValidationFailure | null {
  if (
    context.protocolVersion !== FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION
    || !isNonEmptyString(context.createdAt)
    || !Array.isArray(context.toolResults)
    || !Array.isArray(context.insights)
    || !isNonEmptyString(context.userIntent)
  ) {
    return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The financial conversation context contract is invalid.')
  }

  for (const mapped of context.toolResults) {
    const validation = validateMappedToolResult(mapped)
    if (validation !== null) {
      return validation
    }
  }

  if (
    context.executionPlan === null
    || context.executionPlan === undefined
    || context.activationDecision === null
    || context.activationDecision === undefined
  ) {
    return createFailure('INVALID_FINANCIAL_CONVERSATION_CONTEXT', 'The financial conversation context requires execution and activation metadata.')
  }

  return null
}

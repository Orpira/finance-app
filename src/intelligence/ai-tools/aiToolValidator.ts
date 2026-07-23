import {
  AI_TOOL_PERMISSIONS,
  AI_TOOL_FAILURE_CODES,
  type AITool,
  type AIToolContext,
  type AIToolExecutionRequest,
  type AIToolFailure,
  type AIToolFailureCode,
  type AIToolJsonValue,
  type AIToolSchemaNode,
} from './aiToolContracts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIToolJsonValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (value instanceof Date || seen.has(value)) {
    return false
  }

  const nextSeen = new Set(seen)
  nextSeen.add(value)

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, nextSeen))
  }

  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value).every((item) => isJsonValue(item, nextSeen))
}

function isKnownFailureCode(value: string): value is AIToolFailureCode {
  return AI_TOOL_FAILURE_CODES.includes(value as AIToolFailureCode)
}

function isKnownPermission(value: string): boolean {
  return AI_TOOL_PERMISSIONS.includes(value as (typeof AI_TOOL_PERMISSIONS)[number])
}

export function createToolFailure(
  code: AIToolFailureCode,
  safeMessage: string,
  retryable = false,
  details?: AIToolFailure['details'],
): AIToolFailure {
  if (!isKnownFailureCode(code)) {
    throw new Error(`Unknown AI tool failure code: ${code}`)
  }

  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

export function validateToolSchemaNode(node: AIToolSchemaNode): AIToolFailure | null {
  if (
    node.type !== 'object' &&
    node.type !== 'array' &&
    node.type !== 'string' &&
    node.type !== 'number' &&
    node.type !== 'boolean' &&
    node.type !== 'null'
  ) {
    return createToolFailure('INVALID_TOOL', 'The tool schema node type is invalid.')
  }

  if (node.required !== undefined && !node.required.every((key) => isNonEmpty(key))) {
    return createToolFailure('INVALID_TOOL', 'The tool schema required list is invalid.')
  }

  if (node.properties !== undefined) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (!isNonEmpty(key)) {
        return createToolFailure('INVALID_TOOL', 'The tool schema property name is invalid.')
      }
      const nested = validateToolSchemaNode(value)
      if (nested) {
        return nested
      }
    }
  }

  if (node.items !== undefined) {
    const nested = validateToolSchemaNode(node.items)
    if (nested) {
      return nested
    }
  }

  if (
    node.enum !== undefined &&
    !node.enum.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
  ) {
    return createToolFailure('INVALID_TOOL', 'The tool schema enum contains unsupported values.')
  }

  return null
}

export function validateToolDefinition(tool: AITool): AIToolFailure | null {
  const definition = tool.definition

  if (!isNonEmpty(definition.name)) {
    return createToolFailure('INVALID_TOOL', 'The tool name is required.')
  }

  if (!isNonEmpty(definition.description)) {
    return createToolFailure('INVALID_TOOL', 'The tool description is required.')
  }

  if (definition.deterministic !== true || definition.failClosed !== true) {
    return createToolFailure('INVALID_TOOL', 'The tool definition must be deterministic and fail-closed.')
  }

  if (!isKnownPermission(definition.permission)) {
    return createToolFailure('INVALID_TOOL', 'The tool permission level is invalid.')
  }

  const inputValidation = validateToolSchemaNode(definition.inputSchema)
  if (inputValidation) {
    return inputValidation
  }

  const outputValidation = validateToolSchemaNode(definition.outputSchema)
  if (outputValidation) {
    return outputValidation
  }

  return null
}

export function validateToolContext(context: AIToolContext): AIToolFailure | null {
  if (!isNonEmpty(context.executionId)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool execution id is invalid.')
  }

  if (!isNonEmpty(context.conversationId) || !isNonEmpty(context.sessionId)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool conversation context is invalid.')
  }

  if (!isNonEmpty(context.providerId) || !isNonEmpty(context.model)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool provider context is invalid.')
  }

  if (!isNonEmpty(context.requestedAt)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool request timestamp is invalid.')
  }

  return null
}

export function validateToolExecutionRequest(
  request: AIToolExecutionRequest,
): AIToolFailure | null {
  if (!isNonEmpty(request.toolName)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool name is required for execution.')
  }

  if (!isRecord(request.arguments) || !isJsonValue(request.arguments, new Set())) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool arguments must be JSON-safe.')
  }

  if (
    request.timeoutMs !== undefined &&
    (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0)
  ) {
    return createToolFailure('INVALID_ARGUMENTS', 'The tool timeout must be a positive integer.')
  }

  return validateToolContext(request.context)
}

function matchesPrimitive(node: AIToolSchemaNode, value: unknown): boolean {
  if (node.type === 'string') return typeof value === 'string'
  if (node.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (node.type === 'boolean') return typeof value === 'boolean'
  if (node.type === 'null') return value === null
  return false
}

function validateEnum(node: AIToolSchemaNode, value: unknown): boolean {
  if (node.enum === undefined) {
    return true
  }

  return node.enum.some((entry) => entry === value)
}

export function validateValueAgainstSchema(node: AIToolSchemaNode, value: unknown): boolean {
  if (node.type === 'object') {
    if (!isRecord(value)) {
      return false
    }

    const required = new Set(node.required ?? [])
    for (const requiredKey of required) {
      if (!(requiredKey in value)) {
        return false
      }
    }

    const properties = node.properties ?? {}
    for (const [key, propertyValue] of Object.entries(value)) {
      const schema = properties[key]
      if (schema === undefined) {
        if (node.additionalProperties === false) {
          return false
        }
        if (!isJsonValue(propertyValue, new Set())) {
          return false
        }
        continue
      }

      if (!validateValueAgainstSchema(schema, propertyValue)) {
        return false
      }
    }

    return true
  }

  if (node.type === 'array') {
    if (!Array.isArray(value)) {
      return false
    }

    if (node.items === undefined) {
      return true
    }

    return value.every((item) => validateValueAgainstSchema(node.items as AIToolSchemaNode, item))
  }

  return matchesPrimitive(node, value) && validateEnum(node, value)
}

import type {
  AITool,
  AIToolExecutionRequest,
  AIToolExecutionResult,
  AIToolExecutor,
  AIToolFailure,
  AIToolJsonValue,
  AIToolParseResult,
  AIToolRegistry,
} from './aiToolContracts'
import {
  createToolFailure,
  validateToolExecutionRequest,
  validateValueAgainstSchema,
} from './aiToolValidator'

const TOOL_CALL_TYPE = 'tool_call'

function nowMs(): number {
  return Date.now()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isToolFailure(value: unknown): value is AIToolFailure {
  return isRecord(value) && value.kind === 'failure' && typeof value.code === 'string'
}

function sanitizeJsonObject(value: unknown): Readonly<Record<string, AIToolJsonValue>> | null {
  if (!isRecord(value)) {
    return null
  }

  const clone = structuredClone(value)
  if (!isRecord(clone)) {
    return null
  }

  return clone as Readonly<Record<string, AIToolJsonValue>>
}

function parseToolCallEnvelope(content: string): {
  readonly toolName: string
  readonly arguments: Readonly<Record<string, AIToolJsonValue>>
} | AIToolFailure | null {
  const trimmed = content.trim()
  if (trimmed.length === 0 || !trimmed.startsWith('{')) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  const hasToolShape = 'toolName' in parsed || 'type' in parsed
  if (!hasToolShape) {
    return null
  }

  if (parsed.type !== TOOL_CALL_TYPE) {
    return createToolFailure('INVALID_TOOL', 'The provider emitted an invalid tool call envelope.')
  }

  if (typeof parsed.toolName !== 'string' || parsed.toolName.trim().length === 0) {
    return createToolFailure('INVALID_TOOL', 'The provider tool call is missing a valid toolName.')
  }

  const args = sanitizeJsonObject(parsed.arguments ?? {})
  if (args === null) {
    return createToolFailure('INVALID_ARGUMENTS', 'The provider tool call arguments are not JSON-safe.')
  }

  return {
    toolName: parsed.toolName,
    arguments: args,
  }
}

async function executeWithTimeout(
  tool: AITool,
  request: AIToolExecutionRequest,
  timeoutMs: number,
): Promise<AIToolExecutionResult> {
  return new Promise((resolve) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      resolve(createToolFailure('TOOL_TIMEOUT', `Tool '${request.toolName}' timed out.`, true))
    }, timeoutMs)

    tool.execute({ arguments: request.arguments, context: request.context })
      .then((result) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch(() => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeoutId)
        resolve(createToolFailure('TOOL_EXECUTION_FAILED', `Tool '${request.toolName}' failed unexpectedly.`, true))
      })
  })
}

export function createAIToolExecutor(input: {
  readonly registry: AIToolRegistry
  readonly defaultTimeoutMs?: number
}): AIToolExecutor {
  const defaultTimeoutMs = input.defaultTimeoutMs ?? 3_000

  function resolveRequestFromProviderResponse(value: {
    readonly content: string
    readonly context: AIToolExecutionRequest['context']
    readonly timeoutMs?: number
  }): AIToolParseResult {
    const envelope = parseToolCallEnvelope(value.content)
    if (envelope === null) {
      return {
        kind: 'success',
        request: null,
      }
    }

    if (isToolFailure(envelope)) {
      return envelope
    }

    return {
      kind: 'success',
      request: {
        toolName: envelope.toolName,
        arguments: envelope.arguments,
        context: value.context,
        ...(value.timeoutMs === undefined ? {} : { timeoutMs: value.timeoutMs }),
      },
    }
  }

  async function execute(request: AIToolExecutionRequest): Promise<AIToolExecutionResult> {
    const requestValidation = validateToolExecutionRequest(request)
    if (requestValidation) {
      return requestValidation
    }

    const resolved = input.registry.resolve(request.toolName)
    if (resolved.kind === 'failure') {
      return resolved
    }

    const tool = resolved.tool
    const allowedPermissions = request.context.allowedPermissions
    if (
      allowedPermissions !== undefined
      && !allowedPermissions.includes(tool.definition.permission)
    ) {
      return createToolFailure(
        'TOOL_PERMISSION_DENIED',
        `Tool '${tool.definition.name}' is not allowed in current permission scope.`,
      )
    }

    if (!validateValueAgainstSchema(tool.definition.inputSchema, request.arguments)) {
      return createToolFailure('INVALID_ARGUMENTS', `Tool '${tool.definition.name}' received invalid arguments.`)
    }

    const startedAt = nowMs()
    const executionResult = await executeWithTimeout(
      tool,
      request,
      request.timeoutMs ?? defaultTimeoutMs,
    )

    if (executionResult.kind === 'failure') {
      return executionResult
    }

    if (!validateValueAgainstSchema(tool.definition.outputSchema, executionResult.value.output)) {
      return createToolFailure('INVALID_RESULT', `Tool '${tool.definition.name}' returned an invalid result.`)
    }

    return {
      kind: 'success',
      value: {
        toolName: tool.definition.name,
        output: structuredClone(executionResult.value.output),
        permission: tool.definition.permission,
        durationMs: Math.max(0, nowMs() - startedAt),
      },
    }
  }

  return {
    resolveRequestFromProviderResponse,
    execute,
  }
}

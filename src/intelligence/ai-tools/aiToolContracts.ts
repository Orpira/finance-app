export type AIToolJsonPrimitive = string | number | boolean | null

export type AIToolJsonValue =
  | AIToolJsonPrimitive
  | readonly AIToolJsonValue[]
  | { readonly [key: string]: AIToolJsonValue }

export const AI_TOOL_PERMISSIONS = [
  'read-only',
  'write',
  'dangerous',
  'future-confirmation-required',
] as const

export type AIToolPermission = (typeof AI_TOOL_PERMISSIONS)[number]

export const AI_TOOL_FAILURE_CODES = [
  'TOOL_NOT_FOUND',
  'INVALID_TOOL',
  'INVALID_ARGUMENTS',
  'TOOL_EXECUTION_FAILED',
  'TOOL_TIMEOUT',
  'TOOL_PERMISSION_DENIED',
  'TOOL_ALREADY_REGISTERED',
  'INVALID_RESULT',
] as const

export type AIToolFailureCode = (typeof AI_TOOL_FAILURE_CODES)[number]

export interface AIToolFailure {
  readonly kind: 'failure'
  readonly code: AIToolFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIToolJsonValue>>
}

export interface AIToolSchemaNode {
  readonly type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  readonly properties?: Readonly<Record<string, AIToolSchemaNode>>
  readonly required?: readonly string[]
  readonly items?: AIToolSchemaNode
  readonly enum?: readonly AIToolJsonPrimitive[]
  readonly additionalProperties?: boolean
}

export interface AIToolDefinition {
  readonly name: string
  readonly description: string
  readonly permission: AIToolPermission
  readonly deterministic: true
  readonly failClosed: true
  readonly inputSchema: AIToolSchemaNode
  readonly outputSchema: AIToolSchemaNode
  readonly tags?: readonly string[]
}

export interface AIToolContext {
  readonly executionId: string
  readonly conversationId: string
  readonly sessionId: string
  readonly providerId: string
  readonly model: string
  readonly requestedAt: string
  readonly caller: 'PIPELINE' | 'PROVIDER' | 'SYSTEM'
  readonly allowedPermissions?: readonly AIToolPermission[]
}

export interface AIToolExecutionRequest {
  readonly toolName: string
  readonly arguments: Readonly<Record<string, AIToolJsonValue>>
  readonly context: AIToolContext
  readonly timeoutMs?: number
}

export interface AIToolExecutionSuccess {
  readonly kind: 'success'
  readonly value: {
    readonly toolName: string
    readonly output: AIToolJsonValue
    readonly permission: AIToolPermission
    readonly durationMs: number
  }
}

export type AIToolExecutionResult = AIToolExecutionSuccess | AIToolFailure

export type AIToolParseResult =
  | {
    readonly kind: 'success'
    readonly request: AIToolExecutionRequest | null
  }
  | AIToolFailure

export interface AITool {
  readonly definition: AIToolDefinition
  execute(input: {
    readonly arguments: Readonly<Record<string, AIToolJsonValue>>
    readonly context: AIToolContext
  }): Promise<AIToolExecutionResult>
}

export interface AIToolRegistry {
  register(tool: AITool): AIToolExecutionResult
  resolve(name: string): { readonly kind: 'success'; readonly tool: AITool } | AIToolFailure
  listDefinitions(): readonly AIToolDefinition[]
}

export interface AIToolExecutor {
  resolveRequestFromProviderResponse(input: {
    readonly content: string
    readonly context: AIToolContext
    readonly timeoutMs?: number
  }): AIToolParseResult
  execute(request: AIToolExecutionRequest): Promise<AIToolExecutionResult>
}

import type {
  AITool,
  AIToolExecutionResult,
  AIToolPermission,
  AIToolRegistry,
} from './aiToolContracts'
import {
  createToolFailure,
  validateToolDefinition,
} from './aiToolValidator'

function success(value: {
  readonly toolName: string
  readonly output: {
    readonly registered: true
  }
  readonly permission: AIToolPermission
  readonly durationMs: number
}): AIToolExecutionResult {
  return {
    kind: 'success',
    value,
  }
}

export function createAIToolRegistry(initialTools: readonly AITool[] = []): AIToolRegistry {
  const tools = new Map<string, AITool>()

  function register(tool: AITool): AIToolExecutionResult {
    const validation = validateToolDefinition(tool)
    if (validation) {
      return validation
    }

    const key = tool.definition.name.trim().toLowerCase()
    if (tools.has(key)) {
      return createToolFailure(
        'TOOL_ALREADY_REGISTERED',
        `The tool '${tool.definition.name}' is already registered.`,
      )
    }

    tools.set(key, tool)
    return success({
      toolName: tool.definition.name,
      output: {
        registered: true,
      },
      permission: tool.definition.permission,
      durationMs: 0,
    })
  }

  function resolve(name: string) {
    const key = name.trim().toLowerCase()
    const tool = tools.get(key)

    if (!tool) {
      return createToolFailure('TOOL_NOT_FOUND', `The tool '${name}' is not registered.`)
    }

    return {
      kind: 'success' as const,
      tool,
    }
  }

  function listDefinitions() {
    return [...tools.values()].map((tool) => ({
      ...tool.definition,
      tags: tool.definition.tags === undefined ? undefined : [...tool.definition.tags],
    }))
  }

  for (const tool of initialTools) {
    const added = register(tool)
    if (added.kind === 'failure') {
      throw new Error(added.safeMessage)
    }
  }

  return {
    register,
    resolve,
    listDefinitions,
  }
}

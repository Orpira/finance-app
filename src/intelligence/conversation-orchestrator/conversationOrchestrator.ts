import {
  createAIToolExecutor,
  createToolFailure,
  type AIToolExecutor,
  type AIToolExecutionResult,
  type AIToolRegistry,
  type AIToolResolver,
} from '../ai-tools'
import { createFinancialAIToolResolver } from '../ai-tools/financial'
import type {
  FinancialToolsCatalogDependencies,
} from '../ai-tools/financial'
import type {
  AIConversationOrchestrator,
  AIConversationOrchestratorExecutionFailure,
  AIConversationOrchestratorExecutionSuccess,
  AIConversationOrchestratorRequest,
  AIConversationOrchestratorResult,
} from './conversationOrchestratorContracts'
import {
  createConversationExecutionResult,
} from './conversationOrchestratorFactory'
import {
  validateConversationOrchestratorRequest,
} from './conversationOrchestratorValidator'

function nowIso(): string {
  return new Date().toISOString()
}

function mapStepFailure(
  step: AIConversationOrchestratorRequest['steps'][number],
  error: Extract<AIToolExecutionResult, { readonly kind: 'failure' }>,
): AIConversationOrchestratorExecutionFailure {
  return {
    kind: 'failure',
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    error,
  }
}

function mapStepSuccess(
  step: AIConversationOrchestratorRequest['steps'][number],
  resolvedToolName: string,
  execution: Extract<AIToolExecutionResult, { readonly kind: 'success' }>,
): AIConversationOrchestratorExecutionSuccess {
  return {
    kind: 'success',
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    resolvedToolName,
    execution: execution.value,
  }
}

function withStepExecutionContext(
  request: AIConversationOrchestratorRequest,
  order: number,
) {
  return {
    ...request.context,
    executionId: `${request.executionId}:step:${order}`,
  }
}

export function createConversationOrchestrator(input: {
  readonly toolResolver: AIToolResolver
  readonly toolExecutor: AIToolExecutor
}): AIConversationOrchestrator {
  return {
    async execute(request): Promise<AIConversationOrchestratorResult> {
      const validation = validateConversationOrchestratorRequest(request)
      if (validation) {
        return validation
      }

      const startedAt = nowIso()
      const orderedSteps = [...request.steps].sort((left, right) => left.order - right.order)

      const stepResults: Array<AIConversationOrchestratorExecutionSuccess | AIConversationOrchestratorExecutionFailure> = []

      for (const step of orderedSteps) {
        const resolved = input.toolResolver.resolve(step.toolId)
        if (resolved.kind === 'failure') {
          stepResults.push(mapStepFailure(step, resolved))
          continue
        }

        const execution = await input.toolExecutor.execute({
          toolName: resolved.tool.definition.name,
          arguments: step.arguments,
          context: withStepExecutionContext(request, step.order),
          ...(step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs }),
        })

        if (execution.kind === 'failure') {
          stepResults.push(mapStepFailure(step, execution))
          continue
        }

        stepResults.push(mapStepSuccess(step, resolved.tool.definition.name, execution))
      }

      return createConversationExecutionResult({
        executionId: request.executionId,
        startedAt,
        finishedAt: nowIso(),
        steps: stepResults,
      })
    },
  }
}

export function createFinancialConversationOrchestrator(input: {
  readonly registry: AIToolRegistry
  readonly dependencies?: FinancialToolsCatalogDependencies
  readonly toolExecutor?: AIToolExecutor
}): AIConversationOrchestrator {
  const toolResolver = createFinancialAIToolResolver({
    registry: input.registry,
    dependencies: input.dependencies,
  })

  const toolExecutor = input.toolExecutor ?? createAIToolExecutor({
    registry: input.registry,
  })

  if (typeof toolExecutor.execute !== 'function') {
    throw new Error(
      createToolFailure('INVALID_TOOL', 'Conversation orchestrator requires a valid tool executor.').safeMessage,
    )
  }

  return createConversationOrchestrator({
    toolResolver,
    toolExecutor,
  })
}

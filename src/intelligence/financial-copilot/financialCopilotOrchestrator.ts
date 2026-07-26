import {
  createToolFailure,
  type AIToolContext,
  type AIToolExecutionRequest,
  type AIToolExecutionResult,
  type AIToolExecutor,
  type AIToolJsonValue,
  type AIToolRegistry,
} from '../ai-tools'
import type { IntentResolutionToolSelection } from '../intent-resolver/intentResolverContracts'
import { buildToolArguments, type FinancialContextHints } from './toolArgumentBuilder'
import { createExecutionPlan, type ExecutionPlan, type ExecutionPlanStep } from './executionPlanner'
import { normalizeToolResult, type ToolResult } from './resultNormalizer'
import { recordCopilotRuntimeMetric } from './runtimeMetrics'
import { repairToolArguments } from './toolArgumentRepair'
import { createToolSchemaRegistry, type ToolSchemaRegistry } from './toolSchemaRegistry'
import { validateToolArguments } from './toolArgumentValidator'

export const MAX_TOOL_ARGUMENT_ATTEMPTS = 3

export interface CopilotStepOutcome {
  readonly step: ExecutionPlanStep
  readonly result: ToolResult
  readonly rawExecution: AIToolExecutionResult
  readonly originalArguments: Readonly<Record<string, AIToolJsonValue>>
  readonly repairedArguments: Readonly<Record<string, AIToolJsonValue>> | null
  readonly retries: number
}

export interface CopilotExecutionResult {
  readonly executionId: string
  readonly isMultiTool: boolean
  readonly outcomes: readonly CopilotStepOutcome[]
}

export interface FinancialCopilotOrchestratorDependencies {
  readonly registry: AIToolRegistry
  readonly toolExecutor: AIToolExecutor
  readonly now?: () => string
}

async function executeStepWithRepair(input: {
  readonly step: ExecutionPlanStep
  readonly schemaRegistry: ToolSchemaRegistry
  readonly toolExecutor: AIToolExecutor
  readonly context: AIToolContext
  readonly contextHints: FinancialContextHints
  readonly now: () => string
  readonly generatedByOpenAI: boolean
}): Promise<CopilotStepOutcome> {
  const startedAt = Date.now()
  const schemaEntry = input.schemaRegistry.getSchema(input.step.toolId)

  if (schemaEntry === null) {
    const execution: AIToolExecutionResult = createToolFailure(
      'TOOL_NOT_FOUND',
      `Tool '${input.step.toolId}' is not registered.`,
    )
    return {
      step: input.step,
      result: normalizeToolResult({ toolId: input.step.toolId, execution, now: input.now }),
      rawExecution: execution,
      originalArguments: input.step.arguments,
      repairedArguments: null,
      retries: 0,
    }
  }

  const originalArguments = buildToolArguments({
    schema: schemaEntry.inputSchema,
    baseArguments: input.step.arguments,
    context: input.contextHints,
  })

  let currentArguments = originalArguments
  let repairedArguments: Readonly<Record<string, AIToolJsonValue>> | null = null
  let attempt = 0

  while (attempt < MAX_TOOL_ARGUMENT_ATTEMPTS) {
    const validation = validateToolArguments(schemaEntry.inputSchema, currentArguments)

    if (validation.valid) {
      const execution = await input.toolExecutor.execute({
        toolName: input.step.toolId,
        arguments: currentArguments,
        context: input.context,
      })

      recordCopilotRuntimeMetric({
        timestamp: input.now(),
        intent: input.step.toolId,
        candidateToolIds: [input.step.toolId],
        chosenToolId: input.step.toolId,
        originalArguments,
        repairedArguments,
        retries: attempt,
        durationMs: Date.now() - startedAt,
        confidence: execution.kind === 'success' ? 1 : 0,
        success: execution.kind === 'success',
        generatedByOpenAI: input.generatedByOpenAI,
      })

      return {
        step: input.step,
        result: normalizeToolResult({ toolId: input.step.toolId, execution, now: input.now }),
        rawExecution: execution,
        originalArguments,
        repairedArguments,
        retries: attempt,
      }
    }

    const repair = repairToolArguments(schemaEntry.inputSchema, currentArguments)
    if (repair.changes.length === 0) {
      break
    }

    currentArguments = repair.repaired
    repairedArguments = repair.repaired
    attempt += 1
  }

  const execution: AIToolExecutionResult = createToolFailure(
    'INVALID_ARGUMENTS',
    `Tool '${input.step.toolId}' received arguments that could not be validated or repaired.`,
  )

  recordCopilotRuntimeMetric({
    timestamp: input.now(),
    intent: input.step.toolId,
    candidateToolIds: [input.step.toolId],
    chosenToolId: input.step.toolId,
    originalArguments,
    repairedArguments,
    retries: attempt,
    durationMs: Date.now() - startedAt,
    confidence: 0,
    success: false,
    generatedByOpenAI: input.generatedByOpenAI,
  })

  return {
    step: input.step,
    result: normalizeToolResult({ toolId: input.step.toolId, execution, now: input.now }),
    rawExecution: execution,
    originalArguments,
    repairedArguments,
    retries: attempt,
  }
}

export interface FinancialCopilotOrchestrator {
  /**
   * Executes a full plan (single or multi-tool) built from an Intent
   * Resolver's tool selections, validating/repairing/retrying each step's
   * arguments against the tool's real schema before invoking it.
   */
  executePlan(input: {
    readonly executionId: string
    readonly toolSelections: readonly IntentResolutionToolSelection[]
    readonly context: AIToolContext
    readonly contextHints?: FinancialContextHints
    readonly generatedByOpenAI?: boolean
  }): Promise<CopilotExecutionResult>
}

export function createFinancialCopilotOrchestrator(
  dependencies: FinancialCopilotOrchestratorDependencies,
): FinancialCopilotOrchestrator {
  const schemaRegistry = createToolSchemaRegistry(dependencies.registry)
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    async executePlan(input): Promise<CopilotExecutionResult> {
      const plan: ExecutionPlan = createExecutionPlan({
        executionId: input.executionId,
        toolSelections: input.toolSelections,
      })

      const outcomes: CopilotStepOutcome[] = []
      for (const step of plan.steps) {
        // Steps execute sequentially: later steps in a multi-tool plan
        // (e.g. insights after reports) may depend on earlier ones having
        // completed, so no parallelization is attempted here.
        const outcome = await executeStepWithRepair({
          step,
          schemaRegistry,
          toolExecutor: dependencies.toolExecutor,
          context: input.context,
          contextHints: input.contextHints ?? {},
          now,
          generatedByOpenAI: input.generatedByOpenAI ?? false,
        })
        outcomes.push(outcome)
      }

      return {
        executionId: input.executionId,
        isMultiTool: plan.isMultiTool,
        outcomes,
      }
    },
  }
}

/**
 * Wraps a real `AIToolExecutor` into a drop-in-compatible executor whose
 * `.execute()` validates arguments against the tool's real schema and
 * auto-repairs/retries (up to `MAX_TOOL_ARGUMENT_ATTEMPTS`) before
 * delegating to the real executor. This is what decouples the model from
 * the tools: whatever shape OpenAI invents, the tool only ever receives
 * schema-valid arguments or a clean `INVALID_ARGUMENTS` failure.
 */
export function createCopilotAwareToolExecutor(input: {
  readonly registry: AIToolRegistry
  readonly toolExecutor: AIToolExecutor
  readonly contextHints?: FinancialContextHints
  readonly now?: () => string
}): AIToolExecutor {
  const schemaRegistry = createToolSchemaRegistry(input.registry)
  const now = input.now ?? (() => new Date().toISOString())

  return {
    resolveRequestFromProviderResponse: input.toolExecutor.resolveRequestFromProviderResponse,

    async execute(request: AIToolExecutionRequest): Promise<AIToolExecutionResult> {
      const outcome = await executeStepWithRepair({
        step: {
          stepId: request.context.executionId,
          order: 1,
          toolId: request.toolName,
          arguments: request.arguments,
        },
        schemaRegistry,
        toolExecutor: input.toolExecutor,
        context: request.context,
        contextHints: input.contextHints ?? {},
        now,
        generatedByOpenAI: request.context.providerId === 'openai-provider',
      })

      // `rawExecution` preserves the underlying executor's result verbatim
      // (permission, durationMs, exact failure code) so this wrapper stays
      // a faithful drop-in replacement rather than a lossy re-encoding.
      return outcome.rawExecution
    },
  }
}

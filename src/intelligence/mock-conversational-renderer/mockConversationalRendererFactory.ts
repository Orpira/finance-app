import type {
  ConversationResponse,
  ConversationResponseStepFailureBlock,
  ConversationResponseStepSuccessBlock,
} from '../response-composer'
import {
  MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION,
  type ChatMessage,
  type MockConversationalRenderRule,
  type MockConversationalRenderer,
  type MockConversationalRendererResult,
} from './mockConversationalRendererContracts'
import {
  validateChatMessage,
  validateMockConversationResponse,
  validateMockConversationalRenderRules,
} from './mockConversationalRendererValidator'

function normalizeToolId(value: string): string {
  return value.trim().toLowerCase()
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toNumberString(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`
  }
  return value.toFixed(2)
}

function toOutputRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function renderBalance(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const netBalance = summary === null ? null : summary.netBalance

  if (typeof netBalance === 'number' && Number.isFinite(netBalance)) {
    return `Tu balance disponible es de $${toNumberString(netBalance)}.`
  }

  return 'Tu balance disponible fue calculado correctamente.'
}

function renderTransactions(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const summaryCount = summary === null ? null : summary.matchedCount
  const itemCount = Array.isArray(output?.items) ? output.items.length : 0
  const count = typeof summaryCount === 'number' ? summaryCount : itemCount

  const normalizedCount = toCount(count)
  return `Encontré ${normalizedCount} ${normalizedCount === 1 ? 'transacción' : 'transacciones'}.`
}

function renderGoals(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const summaryCount = summary === null ? null : summary.goalCount
  const itemCount = Array.isArray(output?.items) ? output.items.length : 0
  const count = typeof summaryCount === 'number' ? summaryCount : itemCount

  return `Actualmente tienes ${toCount(count)} objetivos financieros.`
}

function renderBudget(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const summaryCount = summary === null ? null : summary.budgetCount
  const itemCount = Array.isArray(output?.items) ? output.items.length : 0
  const count = typeof summaryCount === 'number' ? summaryCount : itemCount

  return `Se encontraron ${toCount(count)} presupuestos.`
}

function renderReports(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const sectionCount = summary === null ? null : summary.sectionCount
  const sections = Array.isArray(output?.sections) ? output.sections.length : 0
  const count = typeof sectionCount === 'number' ? sectionCount : sections

  return `Hay ${toCount(count)} reportes disponibles.`
}

function renderInsights(step: ConversationResponseStepSuccessBlock): string {
  const output = toOutputRecord(step.output)
  const summary = output === null ? null : toOutputRecord(output.summary)
  const rowCount = summary === null ? null : summary.rowCount
  const sections = Array.isArray(output?.sections)
    ? output.sections.reduce((total, section) => {
      const sectionRecord = toOutputRecord(section)
      const rows = sectionRecord !== null && Array.isArray(sectionRecord.rows)
        ? sectionRecord.rows.length
        : 0
      return total + rows
    }, 0)
    : 0
  const count = typeof rowCount === 'number' ? rowCount : sections

  return `Se generaron ${toCount(count)} insights financieros.`
}

const DEFAULT_RULES: readonly MockConversationalRenderRule[] = [
  {
    ruleId: 'balance-summary',
    toolIds: ['financial_balance'],
    render: ({ stepBlock }) => renderBalance(stepBlock),
  },
  {
    ruleId: 'transactions-summary',
    toolIds: ['financial_transactions'],
    render: ({ stepBlock }) => renderTransactions(stepBlock),
  },
  {
    ruleId: 'goals-summary',
    toolIds: ['financial_goals'],
    render: ({ stepBlock }) => renderGoals(stepBlock),
  },
  {
    ruleId: 'budget-summary',
    toolIds: ['financial_budget'],
    render: ({ stepBlock }) => renderBudget(stepBlock),
  },
  {
    ruleId: 'reports-summary',
    toolIds: ['financial_reports'],
    render: ({ stepBlock }) => renderReports(stepBlock),
  },
  {
    ruleId: 'insights-summary',
    toolIds: ['financial_insights'],
    render: ({ stepBlock }) => renderInsights(stepBlock),
  },
]

function findFailureBlock(response: ConversationResponse): ConversationResponseStepFailureBlock | null {
  for (const block of response.blocks) {
    if (block.kind === 'step-failure') {
      return block
    }
  }

  return null
}

function createMessage(
  response: ConversationResponse,
  input: {
    readonly type: ChatMessage['type']
    readonly timestamp: string
    readonly text: string
  },
): ChatMessage {
  return {
    protocolVersion: MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION,
    messageId: `${response.responseId}:mock-renderer`,
    type: input.type,
    origin: 'MOCK_RENDERER',
    timestamp: input.timestamp,
    text: input.text,
    responseId: response.responseId,
    conversationResponse: structuredClone(response),
    traceability: {
      executionId: response.execution.executionId,
      promptContextId: response.execution.promptContextId,
    },
  }
}

function renderUnknownStep(step: ConversationResponseStepSuccessBlock): string {
  return `La ejecución de ${step.resolvedToolName} se completó correctamente.`
}

function buildRuleIndex(rules: readonly MockConversationalRenderRule[]): Map<string, MockConversationalRenderRule> {
  const index = new Map<string, MockConversationalRenderRule>()
  for (const rule of rules) {
    for (const toolId of rule.toolIds) {
      index.set(normalizeToolId(toolId), rule)
    }
  }
  return index
}

export interface CreateMockConversationalRendererInput {
  readonly now?: () => string
  readonly rules?: readonly MockConversationalRenderRule[]
}

export function createMockConversationalRenderer(
  input: CreateMockConversationalRendererInput = {},
): MockConversationalRenderer {
  const now = input.now ?? (() => new Date().toISOString())
  const rules = input.rules ?? DEFAULT_RULES

  const rulesValidation = validateMockConversationalRenderRules(rules)
  const ruleIndex = rulesValidation === null ? buildRuleIndex(rules) : null

  return {
    render(response): MockConversationalRendererResult {
      if (rulesValidation !== null) {
        return rulesValidation
      }

      const responseValidation = validateMockConversationResponse(response)
      if (responseValidation) {
        const safeResponse = structuredClone(response)
        const message = createMessage(safeResponse, {
          type: 'error',
          timestamp: now(),
          text: `No fue posible completar la consulta.\n\nMotivo:\n${responseValidation.safeMessage}`,
        })

        const messageValidation = validateChatMessage(message)
        if (messageValidation) {
          return messageValidation
        }

        return {
          kind: 'success',
          message,
        }
      }

      const failureBlock = findFailureBlock(response)
      if (failureBlock !== null) {
        const message = createMessage(response, {
          type: 'error',
          timestamp: response.metadata.createdAt,
          text: `No fue posible completar la consulta.\n\nMotivo:\n${failureBlock.error.safeMessage}`,
        })

        const messageValidation = validateChatMessage(message)
        if (messageValidation) {
          return messageValidation
        }

        return {
          kind: 'success',
          message,
        }
      }

      const successMessages = response.blocks
        .filter((block): block is ConversationResponseStepSuccessBlock => block.kind === 'step-success')
        .map((block) => {
          const key = normalizeToolId(block.toolId)
          const rule = ruleIndex?.get(key)
          if (rule === undefined) {
            return renderUnknownStep(block)
          }

          const rendered = rule.render({
            stepBlock: block,
            response,
          })

          return rendered.trim().length === 0
            ? renderUnknownStep(block)
            : rendered
        })

      const text = successMessages.length > 0
        ? successMessages.join('\n')
        : 'La consulta se completó correctamente.'

      const message = createMessage(response, {
        type: 'assistant',
        timestamp: response.metadata.createdAt,
        text,
      })

      const messageValidation = validateChatMessage(message)
      if (messageValidation) {
        return messageValidation
      }

      return {
        kind: 'success',
        message,
      }
    },
  }
}

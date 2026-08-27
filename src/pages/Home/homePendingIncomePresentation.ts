import type { FinancialCopilotResult } from '../../intelligence/deterministic-copilot'

type HomeCopilotPresentation = Pick<
  FinancialCopilotResult,
  'insights' | 'todayPriorities' | 'suggestedActions'
> & {
  readonly summary: string
  readonly financialHealthReasons: readonly string[]
}

const UNREPORTED_INCOME_PRESENTATION_IDS = new Set([
  'pending-income',
  'overdue-pending-income',
  'review-pending-income',
])

function isUnreportedIncomeMessage(message: string): boolean {
  const normalizedMessage = message.toLocaleLowerCase('es')

  return normalizedMessage.includes('sin reportar') ||
    normalizedMessage.includes('pendiente de reportar') ||
    normalizedMessage.includes('pendientes de reportar')
}

export function selectHomeCopilotPresentation(
  presentation: HomeCopilotPresentation,
  showUnreportedIncome: boolean,
): HomeCopilotPresentation {
  if (showUnreportedIncome) {
    return presentation
  }

  return {
    insights: presentation.insights.filter(
      (insight) => !UNREPORTED_INCOME_PRESENTATION_IDS.has(insight.id),
    ),
    todayPriorities: presentation.todayPriorities.filter(
      (priority) => !UNREPORTED_INCOME_PRESENTATION_IDS.has(priority.id),
    ),
    suggestedActions: presentation.suggestedActions.filter(
      (action) => !UNREPORTED_INCOME_PRESENTATION_IDS.has(action.id),
    ),
    summary: presentation.summary
      .split(/(?<=\.)\s+/u)
      .filter((sentence) => !isUnreportedIncomeMessage(sentence))
      .join(' '),
    financialHealthReasons: presentation.financialHealthReasons.filter(
      (reason) => !isUnreportedIncomeMessage(reason),
    ),
  }
}
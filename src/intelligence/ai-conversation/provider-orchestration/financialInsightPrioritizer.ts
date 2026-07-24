import type {
  FinancialInsight,
  FinancialInsightPrioritizer,
  FinancialInsightPrioritizerConfig,
} from './financialInsightContracts'
import {
  FINANCIAL_INSIGHT_SEVERITIES,
} from './financialInsightContracts'

const DEFAULT_CONFIG: FinancialInsightPrioritizerConfig = {
  maxInsights: 5,
  severityOrder: FINANCIAL_INSIGHT_SEVERITIES,
  priorityOrder: FINANCIAL_INSIGHT_SEVERITIES,
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildSignature(insight: FinancialInsight): string {
  return [
    normalizeText(insight.category),
    normalizeText(insight.title),
    normalizeText(insight.recommendation),
    normalizeText(insight.sourceTool),
  ].join('|')
}

function rank(value: string, order: readonly string[]): number {
  const index = order.indexOf(value)
  return index === -1 ? order.length : index
}

export function createFinancialInsightPrioritizer(
  config: Partial<FinancialInsightPrioritizerConfig> = {},
): FinancialInsightPrioritizer {
  const resolved: FinancialInsightPrioritizerConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  return {
    prioritize(insights) {
      const deduplicated: FinancialInsight[] = []
      const seen = new Set<string>()

      for (const insight of insights) {
        const signature = buildSignature(insight)
        if (seen.has(signature)) {
          continue
        }

        seen.add(signature)
        deduplicated.push(insight)
      }

      return deduplicated
        .slice()
        .sort((left, right) => {
          const severityRank = rank(left.severity, resolved.severityOrder) - rank(right.severity, resolved.severityOrder)
          if (severityRank !== 0) {
            return severityRank
          }

          const priorityRank = rank(left.priority, resolved.priorityOrder) - rank(right.priority, resolved.priorityOrder)
          if (priorityRank !== 0) {
            return priorityRank
          }

          return left.generatedAt.localeCompare(right.generatedAt)
        })
        .slice(0, resolved.maxInsights)
    },
  }
}

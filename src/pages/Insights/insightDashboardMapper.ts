import {
  mapRecommendedActions,
  type InsightDashboardMapper,
  type InsightDashboardMapperInput,
  type InsightDashboardViewModel,
} from './insightDashboardContracts'

function toGeneratedAtLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function createInsightDashboardMapper(): InsightDashboardMapper {
  return {
    map(input: InsightDashboardMapperInput): InsightDashboardViewModel {
      const recommendedActions = mapRecommendedActions(input.snapshot.actionPlan)

      return {
        title: 'Análisis financiero',
        subtitle: 'Vista de solo lectura basada en cálculos financieros certificados.',
        generatedAt: input.snapshot.generatedAt,
        generatedAtLabel: toGeneratedAtLabel(input.snapshot.generatedAt),
        dataStatus: input.snapshot.isPartial ? 'partial' : 'complete',
        warnings: [...input.snapshot.warnings],
        summary: input.snapshot.financialSummary,
        insights: input.snapshot.insights.map((insight) => ({
          id: insight.insightId,
          category: insight.category,
          priority: insight.priority,
          severity: insight.severity,
          title: insight.title,
          description: insight.description,
          recommendation: insight.recommendation,
          generatedAt: insight.generatedAt,
        })),
        actionPlan: input.snapshot.actionPlan === null
          ? null
          : {
              planId: input.snapshot.actionPlan.planId,
              title: input.snapshot.actionPlan.title,
              summary: input.snapshot.actionPlan.summary,
              objective: input.snapshot.actionPlan.objective,
              priority: input.snapshot.actionPlan.priority,
              estimatedImpact: input.snapshot.actionPlan.estimatedImpact,
              relatedInsights: [...input.snapshot.actionPlan.relatedInsights],
              warnings: [...input.snapshot.actionPlan.warnings],
            },
        recommendedActions: recommendedActions.map((action) => ({
          id: action.actionId,
          type: action.type,
          description: action.description,
          expectedBenefit: action.expectedBenefit,
          effort: action.effort,
          priority: action.priority,
          requiresConfirmation: action.requiresConfirmation,
        })),
      }
    },
  }
}

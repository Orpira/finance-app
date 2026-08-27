import { describe, expect, it } from 'vitest'

import { selectHomeCopilotPresentation } from '../src/pages/Home/homePendingIncomePresentation'

const pendingInsight = {
  id: 'pending-income',
  message: 'Tienes 2 ingresos sin reportar.',
  explanation: 'Uno lleva más de 7 días pendiente.',
  tone: 'attention' as const,
  evidence: [],
}
const otherInsight = {
  id: 'income-change',
  message: 'Tus ingresos aumentaron.',
  explanation: 'Comparación mensual.',
  tone: 'positive' as const,
  evidence: [],
}
const pendingPriority = {
  id: 'overdue-pending-income',
  message: 'Un ingreso lleva más de 7 días sin reportar.',
  action: { label: 'Revisar ahora', to: '/income/pendientes' },
}
const otherPriority = {
  id: 'today-appointments',
  message: 'Hoy tienes una cita.',
  action: { label: 'Ver agenda', to: '/agenda' },
}
const pendingAction = {
  id: 'review-pending-income',
  label: 'Revisar ingresos pendientes',
  to: '/movements?reported=unreported',
}
const otherAction = {
  id: 'compare-period',
  label: 'Comparar con el mes anterior',
  to: '/conversation',
}
const baseSummary = 'Durante este mes registraste 2 ingresos y 1 gasto. Tus ingresos aumentaron un 10 % respecto al mes anterior.'
const financialReason = 'Los ingresos cubren los gastos del periodo.'

function withPendingIncome() {
  return {
    insights: [otherInsight, pendingInsight],
    todayPriorities: [otherPriority, pendingPriority],
    suggestedActions: [pendingAction, otherAction],
    summary: `${baseSummary} Todavía tienes 2 ingresos sin reportar.`,
    financialHealthReasons: [financialReason, 'Hay ingresos vencidos sin reportar.'],
  }
}

function withoutPendingIncome() {
  return {
    insights: [otherInsight],
    todayPriorities: [otherPriority],
    suggestedActions: [otherAction],
    summary: `${baseSummary} No tienes ingresos pendientes de reportar.`,
    financialHealthReasons: [financialReason],
  }
}

describe('selectHomeCopilotPresentation', () => {
  it('conserva exactamente la presentación actual cuando la opción está activada y hay pendientes', () => {
    const current = withPendingIncome()

    expect(selectHomeCopilotPresentation(current, true)).toBe(current)
  })

  it('conserva el comportamiento actual cuando está activada y no hay pendientes', () => {
    const current = withoutPendingIncome()

    expect(selectHomeCopilotPresentation(current, true)).toBe(current)
  })

  it('oculta sólo el aviso, la prioridad y la acción de pendientes cuando está desactivada', () => {
    const current = withPendingIncome()
    const selected = selectHomeCopilotPresentation(current, false)

    expect(selected).toEqual({
      insights: [otherInsight],
      todayPriorities: [otherPriority],
      suggestedActions: [otherAction],
      summary: baseSummary,
      financialHealthReasons: [financialReason],
    })
    expect(current).toEqual(withPendingIncome())
  })

  it('vuelve a mostrar los elementos al pasar de desactivada a activada', () => {
    const current = withPendingIncome()

    expect(selectHomeCopilotPresentation(current, false).insights).not.toContain(pendingInsight)
    expect(selectHomeCopilotPresentation(current, true).insights).toContain(pendingInsight)
  })

  it('deja de mostrar los elementos al pasar de activada a desactivada', () => {
    const current = withPendingIncome()

    expect(selectHomeCopilotPresentation(current, true).todayPriorities).toContain(pendingPriority)
    expect(selectHomeCopilotPresentation(current, false).todayPriorities).not.toContain(pendingPriority)
  })
})
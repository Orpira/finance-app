import { describe, expect, it } from 'vitest'

import {
  getIncomeListModeFeatures,
  getIncomeReportingVisibility,
} from '../src/pages/Income/incomeListModeFeatures'

describe('income list features by usage mode', () => {
  it('hides additionals and operational statuses in personal mode', () => {
    expect(
      getIncomeListModeFeatures({ usageMode: 'basic', userType: 'basic' }),
    ).toEqual({
      showAdditionals: false,
      showOperationalStatus: false,
    })
  })

  it('keeps additionals and operational statuses in professional mode', () => {
    expect(
      getIncomeListModeFeatures({
        usageMode: 'professional',
        userType: 'primary',
      }),
    ).toEqual({
      showAdditionals: true,
      showOperationalStatus: true,
    })
  })
})

describe('income reporting visibility', () => {
  it('muestra selección y estado pendiente cuando la preferencia está activada', () => {
    expect(getIncomeReportingVisibility({
      showUnreportedIncome: true,
      hasSelectableIncomes: true,
      hasSelectedIncomes: true,
      isSelectable: true,
      canReport: true,
      isReported: false,
    })).toEqual({
      showSelectVisible: true,
      showSelectionSummary: true,
      showIndividualSelection: true,
      showReportBadge: true,
      showMarkAsReportedAction: true,
    })
  })

  it('oculta únicamente selección y estado no reportado cuando está desactivada', () => {
    expect(getIncomeReportingVisibility({
      showUnreportedIncome: false,
      hasSelectableIncomes: true,
      hasSelectedIncomes: true,
      isSelectable: true,
      canReport: true,
      isReported: false,
    })).toEqual({
      showSelectVisible: false,
      showSelectionSummary: false,
      showIndividualSelection: false,
      showReportBadge: false,
      showMarkAsReportedAction: false,
    })
  })

  it('mantiene visible el estado reportado al ocultar la experiencia de pendientes', () => {
    expect(getIncomeReportingVisibility({
      showUnreportedIncome: false,
      canReport: true,
      isReported: true,
    }).showReportBadge).toBe(true)
  })

  it('oculta el botón "Marcar como reportado" al desactivar la preferencia, aunque el registro sea reportable', () => {
    expect(getIncomeReportingVisibility({
      showUnreportedIncome: false,
      canReport: true,
      isReported: false,
    }).showMarkAsReportedAction).toBe(false)
  })

  it('no oculta el estado operacional Finalizado en modo profesional', () => {
    const reportingVisibility = getIncomeReportingVisibility({
      showUnreportedIncome: false,
      canReport: true,
      isReported: false,
    })
    const modeFeatures = getIncomeListModeFeatures({
      usageMode: 'professional',
      userType: 'primary',
    })

    expect(reportingVisibility.showReportBadge).toBe(false)
    expect(modeFeatures.showOperationalStatus).toBe(true)
  })
})
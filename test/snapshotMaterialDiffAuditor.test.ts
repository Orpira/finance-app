import { describe, expect, it } from 'vitest'

import {
  auditCanonicalSnapshotMaterialDiff,
  type SnapshotMaterialDiffAudit,
} from '../src/intelligence/financial-snapshot/snapshotMaterialDiffAuditor'
import type {
  CanonicalSnapshotDocument,
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
} from '../src/types/financialSnapshot'

const code = (value: string) => value as SnapshotNormativeCode

function baseDocument(): CanonicalSnapshotDocument<{
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
  readonly scheduledMinutes: number
  readonly actualMinutes: number
  readonly balanceReport: {
    readonly generalBalance: number
    readonly incomeGrossTotal: number
    readonly expenseTotal: number
  }
}> {
  return {
    canonicalizationVersion: 'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    payload: {
      snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
      engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
      rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
      scope: {
        kind: 'monthly',
        periodStart: '2026-07-01' as CivilDate,
        periodEndExclusive: '2026-08-01' as CivilDate,
        periodBoundary: '[start,end)',
        timezone: 'Europe/Madrid' as IanaTimeZone,
        usageMode: 'basic',
        currency: 'EUR',
        filters: {},
      },
      engineResult: {
        incomeCount: 1,
        expenseCount: 1,
        adjustmentCount: 0,
        scheduledMinutes: 60,
        actualMinutes: 60,
        balanceReport: {
          generalBalance: 80,
          incomeGrossTotal: 100,
          expenseTotal: 20,
        },
      },
      evidence: {
        strategy: 'embedded-v1',
        records: [
          {
            kind: 'income',
            disposition: 'included',
            identityKind: 'persisted-id',
            sourceId: 1,
            logicalDate: '2026-07-10' as CivilDate,
            fields: {
              resolvedType: 'ingreso',
              usageMode: 'basic',
              duration: 60,
              currency: 'EUR',
              eurValue: 100,
              copValue: 440000,
            },
          },
        ],
        context: [
          {
            kind: 'settings-context',
            usageMode: 'basic',
            currency: 'EUR',
            timezone: 'Europe/Madrid' as IanaTimeZone,
          },
        ],
        candidateRecordCount: 1,
        includedRecordCount: 1,
        excludedRecordCount: 0,
        coverageCodes: [code('coverage.complete')],
        warningCodes: [],
      },
      appliedRules: [
        {
          ruleId: 'balance.report.current',
          order: 0,
          engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
          rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
          explanationCode: code('rule.balance.report.current'),
          affectedFields: ['engineResult.balanceReport.generalBalance'],
          limitationCodes: [],
          warningCodes: [],
        },
      ],
      metadata: {
        generationReasonCode: code('generation.shadow_evaluation'),
        provenance: 'local',
        qualityCodes: [code('quality.validated_structure')],
        warningCodes: [],
        limitationCodes: [],
      },
      asOfPolicy: 'monthly-render-as-of-operational',
    },
    operationalMetadata: {
      generatedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
      sourceScopeAsOf: '2026-07-15T10:00:00.000Z' as UtcInstant,
    },
  }
}

function mutate<T>(source: T, action: (draft: T) => void): T {
  const copy = structuredClone(source)
  action(copy)
  return copy
}

function changedPaths(audit: SnapshotMaterialDiffAudit): string[] {
  return audit.changedPaths.map((item) => `${item.path}:${item.changeType}:${item.classification}`)
}

describe('auditCanonicalSnapshotMaterialDiff', () => {
  it('1) marca equivalentes documentos V2 idénticos', () => {
    const previous = baseDocument()
    const current = structuredClone(previous)

    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(true)
    expect(audit.changedPaths).toEqual([])
    expect(audit.summaryCodes).toEqual(['diff.none'])
  })

  it('2) ignora metadata operacional fuera del payload material', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.operationalMetadata.generatedAt = '2026-07-15T12:00:00.000Z' as UtcInstant
      item.operationalMetadata.sourceScopeAsOf = '2026-07-15T12:00:00.000Z' as UtcInstant
    })

    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(true)
    expect(changedPaths(audit)).toEqual([
      'operationalMetadata.generatedAt:changed:unknown',
      'operationalMetadata.sourceScopeAsOf:changed:unknown',
    ])
    expect(audit.summaryCodes).toEqual(['diff.none'])
  })

  it('3) detecta cambio financiero general', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.engineResult.balanceReport.generalBalance = 120
    })

    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain(
      'payload.engineResult.balanceReport.generalBalance:changed:financial',
    )
    expect(audit.summaryCodes).toContain('material.financial')
  })

  it('4) detecta cambio de ingreso', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.engineResult.balanceReport.incomeGrossTotal = 130
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain(
      'payload.engineResult.balanceReport.incomeGrossTotal:changed:financial',
    )
  })

  it('5) detecta cambio de gasto', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.engineResult.balanceReport.expenseTotal = 30
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain(
      'payload.engineResult.balanceReport.expenseTotal:changed:financial',
    )
  })

  it('6) detecta cambio de ajuste', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.engineResult.adjustmentCount = 1
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.engineResult.adjustmentCount:changed:financial')
  })

  it('7) detecta cambio de scope', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.scope.periodEndExclusive = '2026-09-01' as CivilDate
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.scope.periodEndExclusive:changed:scope')
  })

  it('8) detecta cambio de moneda', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.scope.currency = 'USD'
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.scope.currency:changed:scope')
  })

  it('9) detecta cambio de usageMode', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.scope.usageMode = 'professional'
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.scope.usageMode:changed:scope')
  })

  it('10) detecta cambio de earningPeriodId', () => {
    const previous = mutate(baseDocument(), (item) => {
      item.payload.scope.earningPeriodId = 9
    })
    const current = mutate(previous, (item) => {
      item.payload.scope.earningPeriodId = 10
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.scope.earningPeriodId:changed:scope')
  })

  it('11) detecta cambio de reglas', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.appliedRules[0].ruleId = 'balance.report.updated'
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.appliedRules[0].ruleId:changed:rule')
  })

  it('12) detecta cambio de orden en appliedRules', () => {
    const previous = mutate(baseDocument(), (item) => {
      item.payload.appliedRules = [
        item.payload.appliedRules[0],
        {
          ...item.payload.appliedRules[0],
          ruleId: 'rule.second',
          order: 1,
        },
      ]
    })
    const current = mutate(previous, (item) => {
      item.payload.appliedRules = [item.payload.appliedRules[1], item.payload.appliedRules[0]]
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.appliedRules:array-order:rule')
  })

  it('13) detecta cambio de evidencia', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.evidence.records[0].logicalDate = '2026-07-11' as CivilDate
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.evidence.records[0].logicalDate:changed:evidence')
  })

  it('14) detecta cambio de multiplicidad legacy', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.evidence.records.push(structuredClone(item.payload.evidence.records[0]))
      item.payload.evidence.candidateRecordCount = 2
      item.payload.evidence.includedRecordCount = 2
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.evidence.records:array-length:evidence')
  })

  it('15) detecta array más largo', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.metadata.warningCodes.push(code('quality.warning.new'))
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(changedPaths(audit)).toContain('payload.metadata.warningCodes:array-length:quality')
    expect(changedPaths(audit)).toContain('payload.metadata.warningCodes[0]:added:quality')
  })

  it('16) detecta campo añadido', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      ;(item.payload.scope.filters as Record<string, unknown>).tag = 'x'
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(changedPaths(audit)).toContain('payload.scope.filters.tag:added:scope')
  })

  it('17) detecta campo eliminado', () => {
    const previous = mutate(baseDocument(), (item) => {
      ;(item.payload.scope.filters as Record<string, unknown>).tag = 'x'
    })
    const current = mutate(previous, (item) => {
      delete (item.payload.scope.filters as Record<string, unknown>).tag
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(changedPaths(audit)).toContain('payload.scope.filters.tag:removed:scope')
  })

  it('18) detecta operational leak dentro de material payload', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      ;(item.payload.metadata as Record<string, unknown>).generatedAt = '2026-07-15T11:00:00.000Z'
    })
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(changedPaths(audit)).toContain('payload.metadata.generatedAt:added:operational-leak')
    expect(audit.summaryCodes).toContain('material.operational-leak')
  })

  it('19) clasifica V1 contra V2 como incompatible', () => {
    const previous = mutate(baseDocument(), (item) => {
      item.canonicalizationVersion = 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion
    })
    const current = baseDocument()
    const audit = auditCanonicalSnapshotMaterialDiff(previous, current)
    expect(audit.equivalent).toBe(false)
    expect(audit.summaryCodes).toEqual(['version.incompatible'])
    expect(changedPaths(audit)).toEqual(['canonicalizationVersion:changed:version'])
  })

  it('20) no muta las entradas', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.engineResult.incomeCount = 2
    })
    const previousBefore = structuredClone(previous)
    const currentBefore = structuredClone(current)

    void auditCanonicalSnapshotMaterialDiff(previous, current)

    expect(previous).toEqual(previousBefore)
    expect(current).toEqual(currentBefore)
  })

  it('21) es determinista', () => {
    const previous = baseDocument()
    const current = mutate(previous, (item) => {
      item.payload.scope.currency = 'USD'
      item.payload.engineResult.incomeCount = 2
      item.payload.evidence.records.push(structuredClone(item.payload.evidence.records[0]))
      item.payload.evidence.candidateRecordCount = 2
      item.payload.evidence.includedRecordCount = 2
    })

    const outputs = Array.from({ length: 10 }, () =>
      JSON.stringify(auditCanonicalSnapshotMaterialDiff(previous, current)),
    )

    expect(new Set(outputs).size).toBe(1)
  })
})

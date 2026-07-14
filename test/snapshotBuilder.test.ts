import { describe, expect, it } from 'vitest'

import {
  buildSnapshotCandidate,
  SnapshotBuilderError,
  type SnapshotBuilderInput,
} from '../src/intelligence/financial-snapshot/snapshotBuilder'
import { runFinancialEngine } from '../src/services/financialEngineAdapter'
import type {
  AppliedRule,
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  FinancialEvidence,
  FinancialEvidenceRecord,
  IanaTimeZone,
  RulesetVersion,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
} from '../src/types/financialSnapshot'
import type { UsageMode } from '../src/types/settings'

const candidateId = 'candidate:local:test' as SnapshotCandidateId
const snapshotVersion = 'financial-snapshot/1.0.0' as SnapshotVersion
const canonicalizationVersion =
  'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion
const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion
const code = (value: string) => value as SnapshotNormativeCode

function evidence(records: readonly FinancialEvidenceRecord[] = []): FinancialEvidence {
  const included = records.filter((record) => record.disposition === 'included').length
  return {
    strategy: 'embedded-v1',
    records,
    context: [],
    candidateRecordCount: records.length,
    includedRecordCount: included,
    excludedRecordCount: records.length - included,
    coverageCodes: [],
    warningCodes: [],
  }
}

function incomeRecord(value = 10): FinancialEvidenceRecord {
  return {
    kind: 'income',
    disposition: 'included',
    identityKind: 'persisted-id',
    sourceId: 1,
    logicalDate: '2026-01-05' as CivilDate,
    fields: {
      resolvedType: 'ingreso',
      duration: 60,
      currency: 'EUR',
      eurValue: value,
      copValue: value * 4_000,
    },
  }
}

function expenseRecord(value = 5): FinancialEvidenceRecord {
  return {
    kind: 'expense',
    disposition: 'included',
    identityKind: 'persisted-id',
    sourceId: 2,
    logicalDate: '2026-01-06' as CivilDate,
    fields: {
      type: 'gasto',
      currency: 'EUR',
      eurValue: value,
      copValue: value * 4_000,
    },
  }
}

function adjustmentRecords(): readonly FinancialEvidenceRecord[] {
  return [
    {
      ...incomeRecord(8),
      kind: 'income-adjustment',
      fields: { ...incomeRecord(8).fields, resolvedType: 'ajuste' },
    },
    {
      ...expenseRecord(-3),
      kind: 'expense-adjustment',
      fields: { ...expenseRecord(-3).fields, type: 'ajuste' },
    },
  ]
}

function appliedRules(): readonly AppliedRule[] {
  return [
    {
      ruleId: 'balance.report.current',
      order: 0,
      engineVersion,
      rulesetVersion,
      explanationCode: code('RULE_BALANCE_CURRENT'),
      affectedFields: ['balanceReport'],
      limitationCodes: [],
      warningCodes: [],
    },
  ]
}

function input(
  overrides: Partial<SnapshotBuilderInput> = {},
  usageMode: UsageMode = 'basic',
): SnapshotBuilderInput {
  const financialEngineResult = runFinancialEngine({
    incomes: [],
    expenses: [],
    currency: 'EUR',
    usageMode,
  })

  return {
    candidateIdentity: { candidateId },
    scope: {
      kind: 'monthly',
      periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: '2026-02-01T00:00:00.000Z' as UtcInstant,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode,
      currency: 'EUR',
      filters: {},
    },
    financialEngineResult,
    evidence: evidence(),
    appliedRules: appliedRules(),
    snapshotVersion,
    canonicalizationVersion,
    engineVersion,
    rulesetVersion,
    metadata: {
      generatedAt: '2026-02-01T00:00:00.000Z' as UtcInstant,
      generationReasonCode: code('BUILD_REQUESTED'),
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
    ...overrides,
  }
}

function expectCode(action: () => unknown, expected: SnapshotBuilderError['code']) {
  try {
    action()
    throw new Error('Expected SnapshotBuilderError')
  } catch (error) {
    expect(error).toBeInstanceOf(SnapshotBuilderError)
    expect((error as SnapshotBuilderError).code).toBe(expected)
    expect((error as SnapshotBuilderError).message).toBe(expected)
  }
}

describe('buildSnapshotCandidate', () => {
  it('construye exclusivamente un candidate draft mínimo y determinista', () => {
    const source = input()
    const first = buildSnapshotCandidate(source)
    const second = buildSnapshotCandidate(source)

    expect(first).toEqual(second)
    expect(first.status).toBe('draft')
    expect(first.engineResult).toEqual(source.financialEngineResult)
    expect(first).not.toHaveProperty('fingerprint')
    expect(first).not.toHaveProperty('sealedAt')
    expect(first).not.toHaveProperty('revision')
    expect(first).not.toHaveProperty('canonicalPayload')
    expect(first).not.toHaveProperty('snapshotId')
  })

  it.each(['basic', 'professional'] as const)('acepta modo %s', (usageMode) => {
    expect(buildSnapshotCandidate(input({}, usageMode)).scope.usageMode).toBe(usageMode)
  })

  it('acepta dataset vacío y scope de temporada', () => {
    const source = input()
    const candidate = buildSnapshotCandidate(input({
      scope: {
        ...source.scope,
        kind: 'season',
        earningPeriodId: 12,
      },
    }, 'professional'))

    expect(candidate.scope.kind).toBe('season')
    expect(candidate.evidence.records).toEqual([])
  })

  it('preserva evidencia de ingresos, gastos y ajustes positivos/negativos en orden', () => {
    const records = [incomeRecord(20), expenseRecord(5), ...adjustmentRecords()]
    const candidate = buildSnapshotCandidate(input({ evidence: evidence(records) }))

    expect(candidate.evidence.records.map((record) => record.kind)).toEqual([
      'income',
      'expense',
      'income-adjustment',
      'expense-adjustment',
    ])
    expect(candidate.evidence.records[2].fields.eurValue).toBe(8)
    expect(candidate.evidence.records[3].fields.eurValue).toBe(-3)
  })

  it('acepta reglas ordenadas de forma contigua desde cero', () => {
    const rules = [
      appliedRules()[0],
      { ...appliedRules()[0], ruleId: 'currency.stored', order: 1 },
    ]
    expect(buildSnapshotCandidate(input({ appliedRules: rules })).appliedRules).toEqual(rules)
  })

  it('rechaza order no contiguo', () => {
    expectCode(
      () => buildSnapshotCandidate(input({
        appliedRules: [{ ...appliedRules()[0], order: 1 }],
      })),
      'SNAPSHOT_INVALID_RULE_ORDER',
    )
  })

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN])(
    'rechaza número financiero no finito: %s',
    (invalidNumber) => {
      const source = input()
      expectCode(
        () => buildSnapshotCandidate(input({
          financialEngineResult: {
            ...source.financialEngineResult,
            scheduledMinutes: invalidNumber,
          },
        })),
        'SNAPSHOT_NON_FINITE_NUMBER',
      )
    },
  )

  it.each([
    ['2026-02-01', '2026-02-01'],
    ['2026-02-02', '2026-02-01'],
  ])('rechaza periodo no creciente %s..%s', (start, end) => {
    const source = input()
    expectCode(
      () => buildSnapshotCandidate(input({
        scope: {
          ...source.scope,
          periodStart: start as CivilDate,
          periodEndExclusive: end as CivilDate,
        },
      })),
      'SNAPSHOT_INVALID_SCOPE',
    )
  })

  it.each(['timezone', 'currency'] as const)('rechaza scope con %s vacío', (field) => {
    const source = input()
    expectCode(
      () => buildSnapshotCandidate(input({
        scope: { ...source.scope, [field]: '   ' },
      })),
      'SNAPSHOT_INVALID_SCOPE',
    )
  })

  it.each([
    'snapshotVersion',
    'canonicalizationVersion',
    'engineVersion',
    'rulesetVersion',
  ] as const)('rechaza %s vacía', (field) => {
    expectCode(
      () => buildSnapshotCandidate(input({ [field]: '   ' })),
      'SNAPSHOT_MISSING_VERSION',
    )
  })

  it('rechaza candidate ID vacío', () => {
    expectCode(
      () => buildSnapshotCandidate(input({
        candidateIdentity: { candidateId: ' ' as SnapshotCandidateId },
      })),
      'SNAPSHOT_INVALID_IDENTITY',
    )
  })

  it('rechaza identidad persistida o fecha lógica vacías en evidencia', () => {
    const missingSourceId = { ...incomeRecord(), sourceId: undefined }
    const missingLogicalDate = {
      ...incomeRecord(),
      logicalDate: ' ' as CivilDate,
    }

    for (const record of [missingSourceId, missingLogicalDate]) {
      expectCode(
        () => buildSnapshotCandidate(input({ evidence: evidence([record]) })),
        'SNAPSHOT_INVALID_IDENTITY',
      )
    }
  })

  it('rechaza conteos de evidencia inconsistentes', () => {
    expectCode(
      () => buildSnapshotCandidate(input({
        evidence: { ...evidence([incomeRecord()]), includedRecordCount: 0 },
      })),
      'SNAPSHOT_EVIDENCE_COUNT_MISMATCH',
    )
  })

  it('rechaza tipos de evidencia fuera del catálogo', () => {
    const invalidRecord = { ...incomeRecord(), kind: 'appointment' }
    expectCode(
      () => buildSnapshotCandidate(input({
        evidence: evidence([invalidRecord as unknown as FinancialEvidenceRecord]),
      })),
      'SNAPSHOT_INVALID_EVIDENCE',
    )
  })

  it.each([
    ['null', null],
    ['Date', new Date('2026-01-01T00:00:00.000Z')],
  ])('rechaza %s en cualquier profundidad', (_label, invalidValue) => {
    const source = input()
    expectCode(
      () => buildSnapshotCandidate({
        ...source,
        financialEngineResult: {
          ...source.financialEngineResult,
          balanceReport: {
            ...source.financialEngineResult.balanceReport,
            invalidValue,
          },
        },
      } as unknown as SnapshotBuilderInput),
      'SNAPSHOT_INVALID_VALUE',
    )
  })

  it('no muta entradas y devuelve copias estructurales independientes', () => {
    const source = input({ evidence: evidence([incomeRecord()]) })
    const before = structuredClone(source)
    const candidate = buildSnapshotCandidate(source)

    expect(source).toEqual(before)
    expect(candidate.scope).not.toBe(source.scope)
    expect(candidate.engineResult).not.toBe(source.financialEngineResult)
    expect(candidate.evidence).not.toBe(source.evidence)
    expect(candidate.appliedRules).not.toBe(source.appliedRules)
    expect(candidate.metadata).not.toBe(source.metadata)
  })

  it('incorpora el resultado oficial sin recalcularlo', () => {
    const source = input()
    const officialResult = {
      ...source.financialEngineResult,
      scheduledMinutes: 777,
      actualMinutes: 333,
      balanceReport: {
        ...source.financialEngineResult.balanceReport,
        generalBalance: -42.75,
      },
    }
    const candidate = buildSnapshotCandidate(input({
      financialEngineResult: officialResult,
    }))

    expect(candidate.engineResult).toEqual(officialResult)
  })
})

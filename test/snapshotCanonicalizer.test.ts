import { describe, expect, it } from 'vitest'

import {
  SnapshotCanonicalizationError,
  canonicalizeValidatedSnapshotCandidate,
  serializeCanonicalSnapshotDocument,
} from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import {
  buildSnapshotCandidate,
  type SnapshotBuilderInput,
} from '../src/intelligence/financial-snapshot/snapshotBuilder'
import { validateSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCandidateValidator'
import { runFinancialEngine } from '../src/services/financialEngineAdapter'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  FinancialEvidenceRecord,
  IanaTimeZone,
  RulesetVersion,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'

const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion
const code = (value: string) => value as SnapshotNormativeCode

function legacyIncome(value = 10): FinancialEvidenceRecord {
  return {
    kind: 'income',
    disposition: 'included',
    identityKind: 'legacy-material',
    logicalDate: '2026-01-05' as CivilDate,
    fields: {
      resolvedType: 'ingreso',
      duration: 0,
      currency: 'EUR',
      eurValue: value,
      copValue: value * 4_000,
    },
  }
}

function validated(
  records: readonly FinancialEvidenceRecord[] = [],
): ValidatedSnapshotCandidate<ReturnType<typeof runFinancialEngine>> {
  const included = records.filter((record) => record.disposition === 'included').length
  const input: SnapshotBuilderInput = {
    candidateIdentity: {
      candidateId: 'candidate:local:canonical-test' as SnapshotCandidateId,
    },
    scope: {
      kind: 'monthly',
      periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: '2026-02-01T00:00:00.000Z' as UtcInstant,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic',
      currency: 'EUR',
      filters: {},
    },
    financialEngineResult: runFinancialEngine({
      incomes: [],
      expenses: [],
      currency: 'EUR',
      usageMode: 'basic',
    }),
    evidence: {
      strategy: 'embedded-v1',
      records,
      context: [],
      candidateRecordCount: records.length,
      includedRecordCount: included,
      excludedRecordCount: records.length - included,
      coverageCodes: [code('coverage.z'), code('coverage.a')],
      warningCodes: [code('warning.z'), code('warning.a')],
    },
    appliedRules: [
      {
        ruleId: 'z.rule',
        order: 0,
        engineVersion,
        rulesetVersion,
        explanationCode: code('RULE_Z'),
        affectedFields: ['z', 'a'],
        limitationCodes: [code('limit.z'), code('limit.a')],
        warningCodes: [code('warning.z'), code('warning.a')],
      },
      {
        ruleId: 'a.rule',
        order: 1,
        engineVersion,
        rulesetVersion,
        explanationCode: code('RULE_A'),
        affectedFields: [],
        limitationCodes: [],
        warningCodes: [],
      },
    ],
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion,
    rulesetVersion,
    metadata: {
      generatedAt: '2026-02-01T00:00:00.000Z' as UtcInstant,
      generationReasonCode: code('BUILD_REQUESTED'),
      provenance: 'local',
      qualityCodes: [code('quality.z'), code('quality.a')],
      warningCodes: [code('warning.z'), code('warning.a')],
      limitationCodes: [],
    },
  }
  return validateSnapshotCandidate(buildSnapshotCandidate(input))
}

function expectCode(action: () => unknown, code: SnapshotCanonicalizationError['code']) {
  expect(action).toThrowError(SnapshotCanonicalizationError)
  try {
    action()
  } catch (error) {
    expect((error as SnapshotCanonicalizationError).code).toBe(code)
    expect((error as SnapshotCanonicalizationError).message).toBe(code)
  }
}

describe('canonicalizeValidatedSnapshotCandidate', () => {
  it('produce exactamente el documento canónico V1 mínimo', () => {
    const document = canonicalizeValidatedSnapshotCandidate(validated())

    expect(Object.keys(document)).toEqual(['canonicalizationVersion', 'payload'])
    expect(document.canonicalizationVersion).toBe('financial-snapshot-c14n/1.0.0')
    expect(document.payload.evidence.records).toEqual([])
    for (const field of ['fingerprint', 'sealedAt', 'revision', 'snapshotId', 'status']) {
      expect(document).not.toHaveProperty(field)
      expect(document.payload).not.toHaveProperty(field)
    }
  })

  it.each(['draft', 'rejected'] as const)('rechaza candidate %s recibido de forma insegura', (status) => {
    expectCode(
      () => canonicalizeValidatedSnapshotCandidate({
        ...validated(),
        status,
      } as unknown as ReturnType<typeof validated>),
      'SNAPSHOT_CANONICALIZATION_INVALID_STATE',
    )
  })

  it('rechaza canonicalizationVersion no soportada', () => {
    expectCode(
      () => canonicalizeValidatedSnapshotCandidate({
        ...validated(),
        canonicalizationVersion: 'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      }),
      'SNAPSHOT_UNSUPPORTED_CANONICALIZATION_VERSION',
    )
  })

  it('ordena objetos sin depender del orden de inserción', () => {
    const first = validated()
    const second = {
      ...first,
      scope: {
        filters: {},
        currency: first.scope.currency,
        usageMode: first.scope.usageMode,
        timezone: first.scope.timezone,
        asOf: first.scope.asOf,
        periodBoundary: first.scope.periodBoundary,
        periodEndExclusive: first.scope.periodEndExclusive,
        periodStart: first.scope.periodStart,
        kind: first.scope.kind,
      },
    }

    expect(serializeCanonicalSnapshotDocument(
      canonicalizeValidatedSnapshotCandidate(first),
    )).toBe(serializeCanonicalSnapshotDocument(
      canonicalizeValidatedSnapshotCandidate(second),
    ))
  })

  it('ordena evidence records y códigos no semánticos sin deduplicar', () => {
    const a = legacyIncome(10)
    const b = { ...legacyIncome(20), logicalDate: '2026-01-03' as CivilDate }
    const first = canonicalizeValidatedSnapshotCandidate(validated([a, b]))
    const second = canonicalizeValidatedSnapshotCandidate(validated([b, a]))

    expect(first).toEqual(second)
    expect(first.payload.evidence.warningCodes).toEqual(['warning.a', 'warning.z'])
    expect(first.payload.metadata.qualityCodes).toEqual(['quality.a', 'quality.z'])
    expect(first.payload.appliedRules[0].warningCodes).toEqual(['warning.a', 'warning.z'])
  })

  it('preserva AppliedRule.order y no ordena reglas por ruleId', () => {
    const rules = canonicalizeValidatedSnapshotCandidate(validated()).payload.appliedRules
    expect(rules.map((rule) => [rule.ruleId, rule.order])).toEqual([
      ['z.rule', 0],
      ['a.rule', 1],
    ])
  })

  it('rechaza AppliedRule.order no contiguo aunque la entrada sea insegura', () => {
    const candidate = validated()
    expectCode(
      () => canonicalizeValidatedSnapshotCandidate({
        ...candidate,
        appliedRules: [{ ...candidate.appliedRules[0], order: 1 }],
      }),
      'SNAPSHOT_CANONICALIZATION_INVALID_RULE_ORDER',
    )
  })

  it('normaliza -0 a 0 y preserva los demás números', () => {
    const candidate = validated()
    const document = canonicalizeValidatedSnapshotCandidate({
      ...candidate,
      engineResult: {
        ...candidate.engineResult,
        scheduledMinutes: -0,
        actualMinutes: 0,
        incomeCount: -7,
      },
    })

    expect(Object.is(document.payload.engineResult.scheduledMinutes, -0)).toBe(false)
    expect(document.payload.engineResult.scheduledMinutes).toBe(0)
    expect(document.payload.engineResult.actualMinutes).toBe(0)
    expect(document.payload.engineResult.incomeCount).toBe(-7)
  })

  it.each([
    ['NaN', Number.NaN, 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
    ['Infinity', Number.POSITIVE_INFINITY, 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
    ['null', null, 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
    ['undefined', undefined, 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
    ['Date', new Date('2026-01-01T00:00:00.000Z'), 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
  ] as const)('rechaza %s material', (_label, invalid, errorCode) => {
    const candidate = validated()
    expectCode(
      () => canonicalizeValidatedSnapshotCandidate({
        ...candidate,
        engineResult: { ...candidate.engineResult, invalid },
      } as unknown as ReturnType<typeof validated>),
      errorCode,
    )
  })

  it('rechaza ciclos y objetos con prototipo personalizado', () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    const custom = Object.create({ inherited: true }) as { value: number }
    custom.value = 1

    for (const [value, errorCode] of [
      [cyclic, 'SNAPSHOT_CANONICALIZATION_CYCLIC_VALUE'],
      [custom, 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'],
    ] as const) {
      const candidate = validated()
      expectCode(
        () => canonicalizeValidatedSnapshotCandidate({
          ...candidate,
          engineResult: { ...candidate.engineResult, value },
        } as unknown as ReturnType<typeof validated>),
        errorCode,
      )
    }
  })

  it('preserva arrays vacíos, strings vacíos y campos ausentes', () => {
    const record = {
      ...legacyIncome(),
      fields: { ...legacyIncome().fields, baseCurrency: '' },
    }
    const document = canonicalizeValidatedSnapshotCandidate(validated([record]))
    const outputRecord = document.payload.evidence.records[0]

    expect(document.payload.metadata.limitationCodes).toEqual([])
    expect(document.payload.scope.filters).toEqual({})
    expect(outputRecord.fields.baseCurrency).toBe('')
    expect(outputRecord).not.toHaveProperty('sourceId')
    expect(document.payload.engineResult.appliedRules).toEqual(['balance.report.current'])
  })

  it('rechaza evidencia incoherente recibida de forma insegura', () => {
    const candidate = validated([legacyIncome()])
    expectCode(
      () => canonicalizeValidatedSnapshotCandidate({
        ...candidate,
        evidence: { ...candidate.evidence, includedRecordCount: 0 },
      }),
      'SNAPSHOT_CANONICALIZATION_INVALID_EVIDENCE',
    )
  })

  it('preserva multiplicidad legacy y distingue cantidades diferentes', () => {
    const duplicate = legacyIncome()
    const two = canonicalizeValidatedSnapshotCandidate(validated([duplicate, duplicate]))
    const reversed = canonicalizeValidatedSnapshotCandidate(validated([duplicate, duplicate]))
    const one = canonicalizeValidatedSnapshotCandidate(validated([duplicate]))

    expect(two).toEqual(reversed)
    expect(two.payload.evidence.records).toHaveLength(2)
    expect(two).not.toEqual(one)
  })

  it('no muta ni comparte referencias mutables con el candidate', () => {
    const candidate = validated([legacyIncome()])
    const before = structuredClone(candidate)
    const document = canonicalizeValidatedSnapshotCandidate(candidate)

    expect(candidate).toEqual(before)
    expect(document.payload.scope).not.toBe(candidate.scope)
    expect(document.payload.engineResult).not.toBe(candidate.engineResult)
    expect(document.payload.evidence).not.toBe(candidate.evidence)
    expect(document.payload.appliedRules).not.toBe(candidate.appliedRules)
    expect(document.payload.metadata).not.toBe(candidate.metadata)
  })

  it('es determinista en ejecuciones y serialización repetidas', () => {
    const candidate = validated([legacyIncome(20), legacyIncome(10)])
    const outputs = Array.from({ length: 10 }, () =>
      serializeCanonicalSnapshotDocument(
        canonicalizeValidatedSnapshotCandidate(candidate),
      ),
    )
    expect(new Set(outputs).size).toBe(1)
  })

  it('preserva exactamente Financial Engine result y distingue contenido financiero', () => {
    const first = validated()
    const second = {
      ...first,
      engineResult: {
        ...first.engineResult,
        balanceReport: { ...first.engineResult.balanceReport, generalBalance: 123.456 },
      },
    }
    const canonicalFirst = canonicalizeValidatedSnapshotCandidate(first)
    const canonicalSecond = canonicalizeValidatedSnapshotCandidate(second)

    expect(canonicalFirst.payload.engineResult).toEqual(first.engineResult)
    expect(canonicalSecond.payload.engineResult.balanceReport.generalBalance).toBe(123.456)
    expect(canonicalFirst).not.toEqual(canonicalSecond)
  })
})

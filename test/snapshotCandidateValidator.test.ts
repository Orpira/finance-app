import { describe, expect, it } from 'vitest'

import {
  buildSnapshotCandidate,
  type SnapshotBuilderInput,
} from '../src/intelligence/financial-snapshot/snapshotBuilder'
import {
  SnapshotCandidateValidationError,
  validateSnapshotCandidate,
} from '../src/intelligence/financial-snapshot/snapshotCandidateValidator'
import { runFinancialEngine } from '../src/services/financialEngineAdapter'
import type {
  CanonicalizationVersion,
  CivilDate,
  DraftSnapshotCandidate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SnapshotCandidate,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
} from '../src/types/financialSnapshot'

const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion
const normativeCode = (value: string) => value as SnapshotNormativeCode

function draft(): DraftSnapshotCandidate<ReturnType<typeof runFinancialEngine>> {
  const input: SnapshotBuilderInput = {
    candidateIdentity: {
      candidateId: 'candidate:local:validation-test' as SnapshotCandidateId,
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
      records: [],
      context: [],
      candidateRecordCount: 0,
      includedRecordCount: 0,
      excludedRecordCount: 0,
      coverageCodes: [],
      warningCodes: [],
    },
    appliedRules: [{
      ruleId: 'balance.report.current',
      order: 0,
      engineVersion,
      rulesetVersion,
      explanationCode: normativeCode('RULE_BALANCE_CURRENT'),
      affectedFields: ['balanceReport'],
      limitationCodes: [],
      warningCodes: [],
    }],
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion,
    rulesetVersion,
    metadata: {
      generatedAt: '2026-02-01T00:00:00.000Z' as UtcInstant,
      generationReasonCode: normativeCode('BUILD_REQUESTED'),
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
  }
  return buildSnapshotCandidate(input)
}

function expectCode(
  action: () => unknown,
  code: SnapshotCandidateValidationError['code'],
): void {
  expect(action).toThrowError(SnapshotCandidateValidationError)
  try {
    action()
  } catch (error) {
    expect((error as SnapshotCandidateValidationError).code).toBe(code)
    expect((error as SnapshotCandidateValidationError).message).toBe(code)
  }
}

describe('validateSnapshotCandidate', () => {
  it('transforma un draft válido en una copia validated determinista', () => {
    const candidate = draft()
    const first = validateSnapshotCandidate(candidate)
    const second = validateSnapshotCandidate(candidate)

    expect(first).toEqual(second)
    expect(first.status).toBe('validated')
    expect(first).not.toBe(candidate)
    expect(first.scope).not.toBe(candidate.scope)
    expect(first.engineResult).not.toBe(candidate.engineResult)
    expect(first.evidence).not.toBe(candidate.evidence)
    expect(first.appliedRules).not.toBe(candidate.appliedRules)
    expect(first.metadata).not.toBe(candidate.metadata)
  })

  it.each(['validated', 'rejected'] as const)('rechaza estado de entrada %s', (status) => {
    expectCode(
      () => validateSnapshotCandidate({ ...draft(), status } as unknown as ReturnType<typeof draft>),
      'SNAPSHOT_VALIDATION_INVALID_STATE',
    )
  })

  it('rechaza scope inválido', () => {
    const candidate = draft()
    expectCode(
      () => validateSnapshotCandidate({
        ...candidate,
        scope: { ...candidate.scope, periodEndExclusive: candidate.scope.periodStart },
      }),
      'SNAPSHOT_VALIDATION_INVALID_SCOPE',
    )
  })

  it('rechaza versiones ausentes, incompatibles o incoherentes', () => {
    expectCode(
      () => validateSnapshotCandidate({
        ...draft(),
        snapshotVersion: ' ' as SnapshotVersion,
      }),
      'SNAPSHOT_VALIDATION_INVALID_VERSION',
    )
    expectCode(
      () => validateSnapshotCandidate({
        ...draft(),
        snapshotVersion: 'financial-snapshot/2.0.0' as SnapshotVersion,
      }),
      'SNAPSHOT_VALIDATION_INCOMPATIBLE_VERSION',
    )
    expectCode(
      () => validateSnapshotCandidate({
        ...draft(),
        rulesetVersion: 'engine-bundled/other' as RulesetVersion,
      }),
      'SNAPSHOT_VALIDATION_INCOMPATIBLE_VERSION',
    )
  })

  it('rechaza reglas no contiguas, duplicadas o con versión divergente', () => {
    const candidate = draft()
    for (const appliedRules of [
      [{ ...candidate.appliedRules[0], order: 1 }],
      [candidate.appliedRules[0], { ...candidate.appliedRules[0], order: 1 }],
      [{ ...candidate.appliedRules[0], engineVersion: 'other' as EngineVersion }],
    ]) {
      expectCode(
        () => validateSnapshotCandidate({ ...candidate, appliedRules }),
        'SNAPSHOT_VALIDATION_INVALID_RULES',
      )
    }
  })

  it('rechaza evidencia con conteos incoherentes', () => {
    const candidate = draft()
    expectCode(
      () => validateSnapshotCandidate({
        ...candidate,
        evidence: { ...candidate.evidence, candidateRecordCount: 1 },
      }),
      'SNAPSHOT_VALIDATION_INVALID_EVIDENCE',
    )
  })

  it('rechaza metadata obligatoria ausente', () => {
    const candidate = draft()
    expectCode(
      () => validateSnapshotCandidate({
        ...candidate,
        metadata: {
          ...candidate.metadata,
          generationReasonCode: ' ' as SnapshotNormativeCode,
        },
      }),
      'SNAPSHOT_VALIDATION_INVALID_METADATA',
    )
  })

  it.each([
    ['null', null, 'SNAPSHOT_VALIDATION_INVALID_VALUE'],
    ['Date', new Date('2026-01-01T00:00:00.000Z'), 'SNAPSHOT_VALIDATION_INVALID_VALUE'],
    ['NaN', Number.NaN, 'SNAPSHOT_VALIDATION_NON_FINITE_NUMBER'],
    ['Infinity', Number.POSITIVE_INFINITY, 'SNAPSHOT_VALIDATION_NON_FINITE_NUMBER'],
  ] as const)('rechaza %s en profundidad', (_label, invalid, errorCode) => {
    const candidate = draft()
    const corrupted = {
      ...candidate,
      engineResult: { ...candidate.engineResult, invalid },
    } as unknown as ReturnType<typeof draft>
    expectCode(() => validateSnapshotCandidate(corrupted), errorCode)
  })

  it('no muta el draft y no añade campos de fases posteriores', () => {
    const candidate = draft()
    const before = structuredClone(candidate)
    const validated = validateSnapshotCandidate(candidate)

    expect(candidate).toEqual(before)
    for (const field of [
      'canonicalPayload',
      'fingerprint',
      'sealedAt',
      'revision',
      'snapshotId',
    ]) {
      expect(validated).not.toHaveProperty(field)
    }
  })

  it('el contrato público no acepta un SnapshotCandidate indiscriminado', () => {
    const candidate: SnapshotCandidate<unknown> = draft()
    expect(candidate.status).toBe('draft')
    expect(validateSnapshotCandidate(candidate)).toHaveProperty('status', 'validated')
  })
})

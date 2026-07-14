import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { assessSnapshotPromotion } from '../src/intelligence/financial-snapshot/snapshotPromotionPolicy'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedFinancialSnapshot,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'

const at = '2026-07-14T10:00:00.000Z' as UtcInstant
const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = `engine-bundled/${engineVersion}` as RulesetVersion

async function validSnapshot(): Promise<SealedFinancialSnapshot> {
  const candidate: ValidatedSnapshotCandidate = {
    status: 'validated',
    identity: { candidateId: 'promotion-candidate' as SnapshotCandidateId },
    scope: {
      kind: 'monthly',
      periodStart: '2026-07-01' as CivilDate,
      periodEndExclusive: '2026-08-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic',
      currency: 'EUR',
      filters: {},
    },
    engineResult: {
      balanceReport: {
        incomeGrossTotal: 0, expenseTotal: 0, adjustmentsPositiveTotal: 0,
        adjustmentsNegativeTotal: 0, adjustmentImpactTotal: 0, netProfit: 0,
        generalBalance: 0, impactByAdjustments: 0, incomesByType: [],
        expensesByType: [], adjustments: [], incomeAdjustments: [],
        expenseAdjustments: [], hasData: false,
      },
      scheduledMinutes: 0, actualMinutes: 0, incomeCount: 0,
      expenseCount: 0, adjustmentCount: 0,
      engineVersion, appliedRules: ['balance.report.current'],
    },
    evidence: {
      strategy: 'embedded-v1', records: [],
      context: [{ kind: 'settings-context', usageMode: 'basic', currency: 'EUR', timezone: 'Europe/Madrid' as IanaTimeZone }],
      candidateRecordCount: 0, includedRecordCount: 0, excludedRecordCount: 0,
      coverageCodes: ['coverage.empty_dataset' as SnapshotNormativeCode],
      warningCodes: [],
    },
    appliedRules: [{
      ruleId: 'balance.report.current', order: 0, engineVersion, rulesetVersion,
      explanationCode: 'rule.balance.report.current' as SnapshotNormativeCode,
      affectedFields: [],
      limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode],
      warningCodes: [],
    }],
    metadata: {
      generatedAt: at,
      generationReasonCode: 'generation.shadow_evaluation' as SnapshotNormativeCode,
      provenance: 'local',
      qualityCodes: ['quality.validated_structure' as SnapshotNormativeCode],
      warningCodes: [],
      limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion,
    rulesetVersion,
  }
  const document = canonicalizeValidatedSnapshotCandidate(candidate)
  const fingerprint = await fingerprintCanonicalSnapshotDocument(document)
  return sealCanonicalSnapshot({
    canonicalDocument: document,
    fingerprint,
    snapshotKey: deriveSnapshotKey(document),
    revision: 1,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    sealedAt: at,
  })
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function mutate(
  source: SealedFinancialSnapshot,
  action: (snapshot: Record<string, unknown>) => void,
): SealedFinancialSnapshot {
  const copy = clone(source) as unknown as Record<string, unknown>
  action(copy)
  return copy as unknown as SealedFinancialSnapshot
}

function failed(snapshot: SealedFinancialSnapshot, code: string): boolean {
  return assessSnapshotPromotion(snapshot).failedChecks.some((check) => check.code === code)
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return
  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
}

describe('Snapshot Promotion Policy', () => {
  let valid: SealedFinancialSnapshot

  beforeEach(async () => {
    valid = await validSnapshot()
  })

  it('declares a completely valid sealed snapshot eligible', () => {
    const assessment = assessSnapshotPromotion(valid)
    expect(assessment.eligible).toBe(true)
    expect(assessment.failedChecks).toEqual([])
    expect(assessment.checks).toHaveLength(24)
  })

  it('rejects an absent fingerprint', () => {
    expect(failed(mutate(valid, (item) => { delete item.fingerprint }), 'fingerprint.present')).toBe(true)
  })

  it('rejects a structurally invalid fingerprint', () => {
    expect(failed(mutate(valid, (item) => {
      ;(item.fingerprint as Record<string, unknown>).value = 'invalid'
    }), 'fingerprint.structure_valid')).toBe(true)
  })

  it('rejects an incompatible fingerprint version', () => {
    expect(failed(mutate(valid, (item) => {
      ;(item.fingerprint as Record<string, unknown>).fingerprintVersion = 'financial-snapshot-fingerprint/2.0.0'
    }), 'fingerprint.version_supported')).toBe(true)
  })

  it('rejects unsupported fingerprint algorithm', () => {
    expect(failed(mutate(valid, (item) => {
      ;(item.fingerprint as Record<string, unknown>).algorithm = 'SHA-1'
    }), 'fingerprint.algorithm_supported')).toBe(true)
  })

  it('rejects incompatible canonicalization version', () => {
    expect(failed(mutate(valid, (item) => {
      item.canonicalizationVersion = 'financial-snapshot-c14n/2.0.0'
    }), 'canonicalization.version_supported')).toBe(true)
  })

  it('rejects incompatible snapshot version', () => {
    expect(failed(mutate(valid, (item) => {
      item.snapshotVersion = 'financial-snapshot/2.0.0'
    }), 'snapshot.version_supported')).toBe(true)
  })

  it('rejects incompatible engine and ruleset versions', () => {
    const snapshot = mutate(valid, (item) => {
      item.engineVersion = 'unknown-engine'
      item.rulesetVersion = ''
    })
    expect(failed(snapshot, 'engine.version_supported')).toBe(true)
    expect(failed(snapshot, 'ruleset.present_and_consistent')).toBe(true)
  })

  it('rejects a status other than sealed', () => {
    expect(failed(mutate(valid, (item) => { item.status = 'persisted' }), 'snapshot.status_sealed')).toBe(true)
  })

  it('rejects snapshotId inconsistent with fingerprint', () => {
    expect(failed(mutate(valid, (item) => {
      ;(item.identity as Record<string, unknown>).snapshotId = 'financial-snapshot:other'
    }), 'snapshot.identity_consistent')).toBe(true)
  })

  it('rejects an absent snapshotKey', () => {
    expect(failed(mutate(valid, (item) => {
      ;(item.identity as Record<string, unknown>).snapshotKey = ''
    }), 'snapshot.key_present')).toBe(true)
  })

  it.each([0, -1, 1.5])('rejects invalid revision %s', (revision) => {
    expect(failed(mutate(valid, (item) => {
      ;(item.revision as Record<string, unknown>).revision = revision
    }), 'revision.valid')).toBe(true)
  })

  it('rejects supersedes on first revision and its absence on later revisions', () => {
    const first = mutate(valid, (item) => {
      ;(item.revision as Record<string, unknown>).supersedesSnapshotId = 'previous'
    })
    const later = mutate(valid, (item) => {
      ;(item.revision as Record<string, unknown>).revision = 2
    })
    expect(failed(first, 'revision.supersedes_consistent')).toBe(true)
    expect(failed(later, 'revision.supersedes_consistent')).toBe(true)
  })

  it('rejects invalid scope and metadata', () => {
    const snapshot = mutate(valid, (item) => {
      ;(item.scope as Record<string, unknown>).periodEndExclusive = '2026-07-01'
      ;(item.metadata as Record<string, unknown>).provenance = 'remote'
    })
    expect(failed(snapshot, 'scope.valid')).toBe(true)
    expect(failed(snapshot, 'metadata.valid')).toBe(true)
  })

  it('rejects insufficient evidence and inconsistent counts', () => {
    const snapshot = mutate(valid, (item) => {
      const evidence = item.evidence as Record<string, unknown>
      evidence.strategy = 'referenced'
      evidence.candidateRecordCount = 1
    })
    expect(failed(snapshot, 'evidence.sufficient')).toBe(true)
    expect(failed(snapshot, 'evidence.counts_consistent')).toBe(true)
  })

  it('rejects empty, unknown and incorrectly ordered rules', () => {
    expect(failed(mutate(valid, (item) => { item.appliedRules = [] }), 'applied_rules.present')).toBe(true)
    expect(failed(mutate(valid, (item) => {
      ;(item.appliedRules as Array<Record<string, unknown>>)[0].ruleId = 'unknown.rule'
    }), 'applied_rules.known')).toBe(true)
    expect(failed(mutate(valid, (item) => {
      ;(item.appliedRules as Array<Record<string, unknown>>)[0].order = 1
    }), 'applied_rules.order_consistent')).toBe(true)
  })

  it('rejects absent canonical document', () => {
    expect(failed(mutate(valid, (item) => { delete item.canonicalDocument }), 'canonical_document.present')).toBe(true)
  })

  it('does not block eligibility for declared warnings', () => {
    const snapshot = mutate(valid, (item) => {
      const warnings = ['legacy.id.unavailable']
      ;(item.metadata as Record<string, unknown>).warningCodes = warnings
      const document = item.canonicalDocument as Record<string, unknown>
      const payload = document.payload as Record<string, unknown>
      ;(payload.metadata as Record<string, unknown>).warningCodes = warnings
    })
    const assessment = assessSnapshotPromotion(snapshot)
    expect(assessment.eligible).toBe(true)
    expect(assessment.warnings).toContain('legacy.id.unavailable')
  })

  it('reports multiple failures in one deterministic assessment', () => {
    const snapshot = mutate(valid, (item) => {
      item.status = 'persisted'
      item.snapshotVersion = 'unknown'
      item.appliedRules = []
    })
    const assessment = assessSnapshotPromotion(snapshot)
    expect(assessment.eligible).toBe(false)
    expect(assessment.failedChecks.map((check) => check.code)).toEqual(expect.arrayContaining([
      'snapshot.status_sealed', 'snapshot.version_supported', 'applied_rules.present',
    ]))
  })

  it('is deterministic and returns identical results for identical inputs', () => {
    expect(assessSnapshotPromotion(valid)).toEqual(assessSnapshotPromotion(clone(valid)))
  })

  it('accepts deeply frozen readonly input without mutation', () => {
    const before = clone(valid)
    deepFreeze(valid)
    assessSnapshotPromotion(valid)
    expect(valid).toEqual(before)
  })

  it('does not use network, clock or randomness', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network') })
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('clock') })
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('random') })
    expect(assessSnapshotPromotion(valid).eligible).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(dateSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()
  })

  it('rejects prohibited runtime values without throwing', () => {
    const snapshot = mutate(valid, (item) => { item.unexpected = Number.NaN })
    expect(failed(snapshot, 'values.allowed')).toBe(true)
  })

  it('throws only when the root contract is not an object', () => {
    expect(() => assessSnapshotPromotion(null as never)).toThrowError('SNAPSHOT_PROMOTION_INVALID_CONTRACT')
  })
})

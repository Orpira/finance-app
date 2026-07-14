import { describe, expect, it } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import {
  SNAPSHOT_FINGERPRINT_ALGORITHM,
  SNAPSHOT_FINGERPRINT_DOMAIN,
  SNAPSHOT_FINGERPRINT_ENCODING,
  SNAPSHOT_FINGERPRINT_VERSION,
  SnapshotFingerprintError,
  fingerprintCanonicalSnapshotDocument,
} from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import type {
  CanonicalSnapshotDocument,
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

function record(value = 10): FinancialEvidenceRecord {
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

function candidate(
  records: readonly FinancialEvidenceRecord[] = [],
): ValidatedSnapshotCandidate<{ readonly balance: number; readonly negativeZero: number }> {
  return {
    status: 'validated',
    identity: {
      candidateId: 'candidate:local:fingerprint-test' as SnapshotCandidateId,
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
    engineResult: { balance: 0, negativeZero: -0 },
    evidence: {
      strategy: 'embedded-v1',
      records,
      context: [],
      candidateRecordCount: records.length,
      includedRecordCount: records.length,
      excludedRecordCount: 0,
      coverageCodes: [],
      warningCodes: [],
    },
    appliedRules: [{
      ruleId: 'balance.report.current',
      order: 0,
      engineVersion,
      rulesetVersion,
      explanationCode: code('RULE_BALANCE_CURRENT'),
      affectedFields: ['balance'],
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
      generationReasonCode: code('BUILD_REQUESTED'),
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
  }
}

function document(records: readonly FinancialEvidenceRecord[] = []) {
  return canonicalizeValidatedSnapshotCandidate(candidate(records))
}

async function value(input: CanonicalSnapshotDocument<unknown>): Promise<string> {
  return (await fingerprintCanonicalSnapshotDocument(input)).value
}

describe('fingerprintCanonicalSnapshotDocument', () => {
  it('produce el contrato SHA-256 V1 exacto en el entorno de test', async () => {
    expect(globalThis.crypto?.subtle?.digest).toBeTypeOf('function')
    const fingerprint = await fingerprintCanonicalSnapshotDocument(document())

    expect(fingerprint).toMatchObject({
      algorithm: SNAPSHOT_FINGERPRINT_ALGORITHM,
      encoding: SNAPSHOT_FINGERPRINT_ENCODING,
      domain: SNAPSHOT_FINGERPRINT_DOMAIN,
      fingerprintVersion: SNAPSHOT_FINGERPRINT_VERSION,
      canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
    })
    expect(fingerprint.value).toMatch(/^[0-9a-f]{64}$/)
  })

  it('es determinista en ejecuciones repetidas', async () => {
    const input = document([record(20), record(10)])
    const outputs = await Promise.all(
      Array.from({ length: 10 }, () => value(input)),
    )
    expect(new Set(outputs).size).toBe(1)
  })

  it('da la misma huella tras canonicalizar órdenes previos distintos', async () => {
    const first = document([record(20), record(10)])
    const second = document([record(10), record(20)])
    expect(await value(first)).toBe(await value(second))
  })

  it('distingue contenido financiero y multiplicidad legacy', async () => {
    const base = document([record(10)])
    const changed = document([record(11)])
    const duplicated = document([record(10), record(10)])

    expect(await value(base)).not.toBe(await value(changed))
    expect(await value(base)).not.toBe(await value(duplicated))
  })

  it('produce la misma huella para -0 y 0 después de canonicalización', async () => {
    const negative = document()
    const positive = canonicalizeValidatedSnapshotCandidate({
      ...candidate(),
      engineResult: { balance: 0, negativeZero: 0 },
    })
    expect(await value(negative)).toBe(await value(positive))
  })

  it('cambios de versiones producen huellas distintas', async () => {
    const base = document()
    const variants: CanonicalSnapshotDocument<unknown>[] = [
      {
        ...base,
        canonicalizationVersion:
          'financial-snapshot-c14n/1.0.1' as CanonicalizationVersion,
      },
      {
        ...base,
        payload: {
          ...base.payload,
          snapshotVersion: 'financial-snapshot/1.0.1' as SnapshotVersion,
        },
      },
      {
        ...base,
        payload: { ...base.payload, engineVersion: 'engine-other' as EngineVersion },
      },
      {
        ...base,
        payload: {
          ...base.payload,
          rulesetVersion: 'engine-bundled/engine-other' as RulesetVersion,
        },
      },
    ]
    const baseline = await value(base)
    for (const variant of variants) {
      expect(await value(variant)).not.toBe(baseline)
    }
  })

  it('cambios de scope, evidencia y reglas producen huellas distintas', async () => {
    const base = document()
    const variants: CanonicalSnapshotDocument<unknown>[] = [
      {
        ...base,
        payload: {
          ...base.payload,
          scope: { ...base.payload.scope, currency: 'USD' },
        },
      },
      document([record()]),
      {
        ...base,
        payload: {
          ...base.payload,
          appliedRules: [{ ...base.payload.appliedRules[0], ruleId: 'other.rule' }],
        },
      },
    ]
    const baseline = await value(base)
    for (const variant of variants) {
      expect(await value(variant)).not.toBe(baseline)
    }
  })

  it('domain separator participa en la preimagen', async () => {
    const input = document()
    const withoutDomain = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(input)),
    )
    const withoutDomainHex = Array.from(new Uint8Array(withoutDomain), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    expect(await value(input)).not.toBe(withoutDomainHex)
  })

  it('cumple un vector SHA-256 conocido del protocolo', async () => {
    const minimal = {
      canonicalizationVersion:
        'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
      payload: {},
    } as unknown as CanonicalSnapshotDocument<unknown>
    expect(await value(minimal)).toBe(
      'a109f2ff83d3c2cba0c0da6365bf5134faca67356a95f27fae22199a5df5928a',
    )
  })

  it('no muta el documento ni añade campos de fases posteriores', async () => {
    const input = document([record()])
    const before = structuredClone(input)
    const fingerprint = await fingerprintCanonicalSnapshotDocument(input)

    expect(input).toEqual(before)
    for (const field of ['sealedAt', 'revision', 'snapshotId', 'status']) {
      expect(input).not.toHaveProperty(field)
      expect(fingerprint).not.toHaveProperty(field)
    }
  })

  it('rechaza documento inválido sin exponer su contenido', async () => {
    const sensitive = 'PRIVATE-FINANCIAL-VALUE'
    const invalid = {
      ...document(),
      payload: { sensitive, invalid: null },
    } as unknown as CanonicalSnapshotDocument<unknown>

    try {
      await fingerprintCanonicalSnapshotDocument(invalid)
      throw new Error('Expected SnapshotFingerprintError')
    } catch (error) {
      expect(error).toBeInstanceOf(SnapshotFingerprintError)
      expect((error as SnapshotFingerprintError).code).toBe(
        'SNAPSHOT_FINGERPRINT_INVALID_DOCUMENT',
      )
      expect((error as Error).message).not.toContain(sensitive)
    }
  })
})

import { describe, expect, it } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import {
  SnapshotSealError,
  deriveSnapshotKey,
  sealCanonicalSnapshot,
  type SnapshotSealingInput,
} from '../src/intelligence/financial-snapshot/snapshotSealer'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedSnapshotId,
  SnapshotCandidateId,
  SnapshotKey,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'

const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion
const code = (value: string) => value as SnapshotNormativeCode

function candidate(balance = 10): ValidatedSnapshotCandidate<{ readonly balance: number }> {
  return {
    status: 'validated',
    identity: { candidateId: 'candidate:local:seal-test' as SnapshotCandidateId },
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
    engineResult: { balance },
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

async function input(balance = 10): Promise<SnapshotSealingInput<{ readonly balance: number }>> {
  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate(balance))
  return {
    canonicalDocument,
    fingerprint: await fingerprintCanonicalSnapshotDocument(canonicalDocument),
    snapshotKey: deriveSnapshotKey(canonicalDocument),
    revision: 1,
    revisionReasonCode: code('revision.source_changed'),
    sealedAt: '2026-02-01T00:00:00.000Z' as UtcInstant,
  }
}

async function expectCode(
  action: () => Promise<unknown>,
  expected: SnapshotSealError['code'],
  sensitive?: string,
): Promise<void> {
  try {
    await action()
    throw new Error('Expected SnapshotSealError')
  } catch (error) {
    expect(error).toBeInstanceOf(SnapshotSealError)
    expect((error as SnapshotSealError).code).toBe(expected)
    expect((error as SnapshotSealError).message).toBe(expected)
    if (sensitive !== undefined) {
      expect((error as Error).message).not.toContain(sensitive)
    }
  }
}

describe('sealCanonicalSnapshot', () => {
  it('sella correctamente un documento mínimo con fingerprint verificado', async () => {
    const source = await input()
    const sealed = await sealCanonicalSnapshot(source)

    expect(sealed.status).toBe('sealed')
    expect(sealed.fingerprint).toEqual(source.fingerprint)
    expect(sealed.identity.snapshotKey).toBe(source.snapshotKey)
    expect(sealed.revision).toEqual({
      revision: 1,
      reasonCode: code('revision.source_changed'),
    })
    expect(sealed.sealedAt).toBe(source.sealedAt)
  })

  it.each([
    ['value', '0'.repeat(64)],
    ['algorithm', 'SHA-1'],
    ['encoding', 'base64url'],
    ['domain', 'other-domain:'],
    ['fingerprintVersion', 'financial-snapshot-fingerprint/2.0.0'],
    ['canonicalizationVersion', 'financial-snapshot-c14n/2.0.0'],
  ] as const)('rechaza fingerprint con %s alterado', async (field, altered) => {
    const source = await input()
    await expectCode(
      () => sealCanonicalSnapshot({
        ...source,
        fingerprint: { ...source.fingerprint, [field]: altered },
      } as unknown as SnapshotSealingInput),
      'SNAPSHOT_SEAL_FINGERPRINT_MISMATCH',
    )
  })

  it('rechaza documento cambiado con fingerprint anterior', async () => {
    const source = await input()
    const changed = canonicalizeValidatedSnapshotCandidate(candidate(999))
    await expectCode(
      () => sealCanonicalSnapshot({
        ...source,
        canonicalDocument: changed,
        snapshotKey: deriveSnapshotKey(changed),
      }),
      'SNAPSHOT_SEAL_FINGERPRINT_MISMATCH',
    )
  })

  it('deriva snapshotId exactamente del fingerprint', async () => {
    const source = await input()
    const sealed = await sealCanonicalSnapshot(source)
    expect(sealed.identity.snapshotId).toBe(
      `financial-snapshot:${source.fingerprint.fingerprintVersion}:${source.fingerprint.value}`,
    )
  })

  it('deriva y valida una snapshotKey estable desde todo el scope', async () => {
    const source = await input()
    expect(source.snapshotKey).toMatch(/^pbsk:v1:monthly:/)
    expect((await sealCanonicalSnapshot(source)).identity.snapshotKey).toBe(
      source.snapshotKey,
    )

    await expectCode(
      () => sealCanonicalSnapshot({
        ...source,
        snapshotKey: 'pbsk:v1:monthly:wrong' as SnapshotKey,
      }),
      'SNAPSHOT_SEAL_INVALID_KEY',
    )
  })

  it('mantiene snapshotKey cuando solo cambia asOf dentro del mismo ámbito', async () => {
    const first = canonicalizeValidatedSnapshotCandidate(candidate())
    const second = canonicalizeValidatedSnapshotCandidate({
      ...candidate(),
      scope: {
        ...candidate().scope,
        asOf: '2026-01-31T23:59:59.999Z' as UtcInstant,
      },
    })

    expect(deriveSnapshotKey(first)).toBe(deriveSnapshotKey(second))
    expect(
      (await fingerprintCanonicalSnapshotDocument(first)).value,
    ).not.toBe((await fingerprintCanonicalSnapshotDocument(second)).value)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza revision inválida %s',
    async (revision) => {
      const source = await input()
      await expectCode(
        () => sealCanonicalSnapshot({ ...source, revision }),
        'SNAPSHOT_SEAL_INVALID_REVISION',
      )
    },
  )

  it('preserva supersedes válido y aplica reglas de presencia por revisión', async () => {
    const source = await input()
    const previous = 'financial-snapshot:previous' as SealedSnapshotId
    const revisionTwo = await sealCanonicalSnapshot({
      ...source,
      revision: 2,
      supersedesSnapshotId: previous,
    })
    expect(revisionTwo.revision.supersedesSnapshotId).toBe(previous)

    await expectCode(
      () => sealCanonicalSnapshot({ ...source, supersedesSnapshotId: previous }),
      'SNAPSHOT_SEAL_INVALID_SUPERSEDES',
    )
    await expectCode(
      () => sealCanonicalSnapshot({ ...source, revision: 2 }),
      'SNAPSHOT_SEAL_INVALID_SUPERSEDES',
    )
    await expectCode(
      () => sealCanonicalSnapshot({
        ...source,
        revision: 2,
        supersedesSnapshotId: ' ' as SealedSnapshotId,
      }),
      'SNAPSHOT_SEAL_INVALID_SUPERSEDES',
    )
  })

  it.each(['', '2026-02-01', '2026-02-01T00:00:00Z', '2026-01-31T23:59:59.999Z'])(
    'rechaza sealedAt inválido %s',
    async (sealedAt) => {
      const source = await input()
      await expectCode(
        () => sealCanonicalSnapshot({ ...source, sealedAt: sealedAt as UtcInstant }),
        'SNAPSHOT_SEAL_INVALID_TIME',
      )
    },
  )

  it('rechaza null, Date y valores no finitos dentro del documento', async () => {
    for (const invalid of [null, new Date('2026-02-01T00:00:00.000Z'), Number.NaN, Infinity]) {
      const source = await input()
      await expectCode(
        () => sealCanonicalSnapshot({
          ...source,
          canonicalDocument: {
            ...source.canonicalDocument,
            payload: { ...source.canonicalDocument.payload, invalid },
          },
        } as unknown as SnapshotSealingInput),
        'SNAPSHOT_SEAL_INVALID_DOCUMENT',
      )
    }
  })

  it('no muta entradas y devuelve copias estructurales independientes', async () => {
    const source = await input()
    const before = structuredClone(source)
    const sealed = await sealCanonicalSnapshot(source)

    expect(source).toEqual(before)
    expect(sealed.canonicalDocument).not.toBe(source.canonicalDocument)
    expect(sealed.canonicalDocument.payload).not.toBe(source.canonicalDocument.payload)
    expect(sealed.fingerprint).not.toBe(source.fingerprint)
    expect(sealed.scope).not.toBe(source.canonicalDocument.payload.scope)
    expect(sealed.evidence).not.toBe(source.canonicalDocument.payload.evidence)
    expect(sealed.metadata).not.toBe(source.canonicalDocument.payload.metadata)
  })

  it('es determinista y nunca produce estados posteriores', async () => {
    const source = await input()
    const first = await sealCanonicalSnapshot(source)
    const second = await sealCanonicalSnapshot(source)

    expect(first).toEqual(second)
    expect(first.status).toBe('sealed')
    expect(first.status).not.toBe('persisted')
    expect(first.status).not.toBe('published')
  })

  it('mismo contenido conserva snapshotId entre revisiones y misma key', async () => {
    const source = await input()
    const first = await sealCanonicalSnapshot(source)
    const second = await sealCanonicalSnapshot({
      ...source,
      revision: 2,
      supersedesSnapshotId: first.identity.snapshotId,
    })

    expect(second.identity.snapshotId).toBe(first.identity.snapshotId)
    expect(second.identity.snapshotKey).toBe(first.identity.snapshotKey)
  })

  it('contenido diferente produce snapshotId distinto', async () => {
    const firstInput = await input(10)
    const secondInput = await input(11)
    const first = await sealCanonicalSnapshot(firstInput)
    const second = await sealCanonicalSnapshot(secondInput)

    expect(second.identity.snapshotId).not.toBe(first.identity.snapshotId)
  })

  it('errores no exponen documento ni fingerprint completo', async () => {
    const source = await input()
    const sensitive = source.fingerprint.value
    await expectCode(
      () => sealCanonicalSnapshot({
        ...source,
        fingerprint: { ...source.fingerprint, value: '0'.repeat(64) },
      }),
      'SNAPSHOT_SEAL_FINGERPRINT_MISMATCH',
      sensitive,
    )
  })
})

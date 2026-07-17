import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import { fingerprintCanonicalKnowledgeDocument } from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
import {
  KnowledgeSealError,
  deriveKnowledgeSnapshotKey,
  sealCanonicalKnowledgeDocument,
  type KnowledgeSealingInput,
} from '../src/intelligence/knowledge-layer/knowledgeSealer'
import { validateKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedFinancialSnapshot,
  SnapshotVersion,
  UtcInstant,
} from '../src/types/financialSnapshot'
import type {
  CanonicalKnowledgeDocument,
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const sealerPath = resolve(
  __dirname,
  '../src/intelligence/knowledge-layer/knowledgeSealer.ts',
)

const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion

const REVISION_REASON = 'revision.source_changed' as KnowledgeRevisionReasonCode

type EngineResultFixture = {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

function baseEngineResult(overrides: Partial<EngineResultFixture> = {}): EngineResultFixture {
  const base: EngineResultFixture = {
    balanceReport: {
      hasData: true,
      generalBalance: 200,
      netProfit: 120,
    },
    incomeCount: 2,
    expenseCount: 1,
    adjustmentCount: 0,
  }

  return {
    balanceReport: {
      ...base.balanceReport,
      ...(overrides.balanceReport ?? {}),
    },
    incomeCount: overrides.incomeCount ?? base.incomeCount,
    expenseCount: overrides.expenseCount ?? base.expenseCount,
    adjustmentCount: overrides.adjustmentCount ?? base.adjustmentCount,
    ...overrides,
    balanceReport: {
      ...base.balanceReport,
      ...(overrides.balanceReport ?? {}),
    },
  }
}

function baseSnapshot(
  engineResult: EngineResultFixture,
  overrides: Record<string, unknown> = {},
): SealedFinancialSnapshot<EngineResultFixture> {
  const snapshot = {
    identity: {
      snapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      snapshotKey: 'snapshot-key:monthly:2026-07',
    },
    revision: {
      revision: 3,
      reasonCode: 'revision.source_changed',
      supersedesSnapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:1111111111111111111111111111111111111111111111111111111111111111',
    },
    status: 'sealed',
    canonicalDocument: {
      canonicalizationVersion:
        'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      payload: {
        snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
        engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
        rulesetVersion:
          'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
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
        engineResult,
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
        appliedRules: [],
        metadata: {
          generationReasonCode: 'generation.shadow_evaluation',
          provenance: 'local',
          qualityCodes: [],
          warningCodes: [],
          limitationCodes: [],
        },
        asOfPolicy: 'monthly-render-as-of-operational',
      },
      operationalMetadata: {
        generatedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
        sourceScopeAsOf: '2026-07-15T10:00:00.000Z' as UtcInstant,
      },
    },
    fingerprint: {
      value:
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      algorithm: 'SHA-256',
      encoding: 'hex-lower',
      domain: 'private-balance:financial-snapshot:fingerprint:v2:',
      fingerprintVersion: 'financial-snapshot-fingerprint/2.0.0',
      canonicalizationVersion:
        'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      hashedComponent: 'material-payload',
    },
    sealedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
    scope: {
      kind: 'monthly',
      periodStart: '2026-07-01' as CivilDate,
      periodEndExclusive: '2026-08-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: '2026-07-15T10:00:00.000Z' as UtcInstant,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic',
      currency: 'EUR',
      filters: {},
    },
    evidence: {
      strategy: 'embedded-v1',
      records: [{ sourceId: 10, kind: 'income' }],
      context: [{ kind: 'settings-context' }],
      candidateRecordCount: 1,
      includedRecordCount: 1,
      excludedRecordCount: 0,
      coverageCodes: ['coverage.complete'],
      warningCodes: [],
    },
    appliedRules: [{ ruleId: 'balance.report.current' }],
    metadata: {
      generatedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
      generationReasonCode: 'generation.shadow_evaluation',
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
    ...overrides,
  }

  return snapshot as unknown as SealedFinancialSnapshot<EngineResultFixture>
}

function builderInput(snapshot: SealedFinancialSnapshot<EngineResultFixture>):
  KnowledgeBuilderInput<EngineResultFixture> {
  return {
    snapshot,
    knowledgeVersion: KNOWLEDGE_VERSION,
    builderVersion: BUILDER_VERSION,
    rulesVersion: RULES_VERSION,
    projectionVersion: PROJECTION_VERSION,
  }
}

function baseCanonicalDocument(
  engineResult: EngineResultFixture = baseEngineResult(),
  snapshotOverrides: Record<string, unknown> = {},
): CanonicalKnowledgeDocument {
  const draft = buildKnowledgeCollectionFromSnapshot(
    builderInput(baseSnapshot(engineResult, snapshotOverrides)),
  )
  const validated = validateKnowledgeCollection(draft)
  return canonicalizeValidatedKnowledgeCollection(validated)
}

async function baseSealingInput(
  engineResult: EngineResultFixture = baseEngineResult(),
): Promise<KnowledgeSealingInput> {
  const canonicalDocument = baseCanonicalDocument(engineResult)
  const fingerprint = await fingerprintCanonicalKnowledgeDocument(canonicalDocument)
  return {
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey: deriveKnowledgeSnapshotKey(canonicalDocument),
    revision: 1,
    revisionReasonCode: REVISION_REASON,
    sealedAt: '2026-07-16T10:30:00.000Z' as UtcInstant,
  }
}

function cloneInput(input: KnowledgeSealingInput): KnowledgeSealingInput {
  return structuredClone(input)
}

async function expectSealError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action()
    throw new Error('Expected KnowledgeSealError')
  } catch (error) {
    expect(error).toBeInstanceOf(KnowledgeSealError)
    expect((error as KnowledgeSealError).code).toBe(code)
  }
}

describe('KnowledgeSealer deterministic sealer', () => {
  it('1. Sellado valido minimo.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.status).toBe('sealed')
  })

  it('2. Fingerprint correcto aceptado.', async () => {
    const input = await baseSealingInput()
    const sealed = await sealCanonicalKnowledgeDocument(input)
    expect(sealed.fingerprint).toEqual(input.fingerprint)
  })

  it('3. Fingerprint value alterado rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: { ...input.fingerprint, value: '0'.repeat(64) },
      }),
      'KNOWLEDGE_SEAL_FINGERPRINT_MISMATCH',
    )
  })

  it('4. Algorithm alterado rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: { ...input.fingerprint, algorithm: 'SHA-1' as never },
      }),
      'KNOWLEDGE_SEAL_INVALID_FINGERPRINT',
    )
  })

  it('5. Encoding alterado rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: { ...input.fingerprint, encoding: 'base64' as never },
      }),
      'KNOWLEDGE_SEAL_INVALID_FINGERPRINT',
    )
  })

  it('6. Domain alterado rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: { ...input.fingerprint, domain: 'other-domain:' as never },
      }),
      'KNOWLEDGE_SEAL_INVALID_FINGERPRINT',
    )
  })

  it('7. fingerprintVersion alterada rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: {
          ...input.fingerprint,
          fingerprintVersion: 'knowledge-fingerprint/9.9.9' as never,
        },
      }),
      'KNOWLEDGE_SEAL_INVALID_FINGERPRINT',
    )
  })

  it('8. canonicalizationVersion alterada rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: {
          ...input.fingerprint,
          canonicalizationVersion: 'knowledge-c14n/9.9.9' as never,
        },
      }),
      'KNOWLEDGE_SEAL_INCOMPATIBLE_VERSION',
    )
  })

  it('9. Documento alterado con fingerprint anterior rechazado.', async () => {
    const input = await baseSealingInput()
    const altered = structuredClone(input.canonicalDocument)
    ;(altered.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${altered.payload.identity.knowledgeCollectionId}:alt`

    await expectSealError(
      () => sealCanonicalKnowledgeDocument({
        ...input,
        canonicalDocument: altered,
        knowledgeSnapshotKey: deriveKnowledgeSnapshotKey(altered),
      }),
      'KNOWLEDGE_SEAL_FINGERPRINT_MISMATCH',
    )
  })

  it('10. KnowledgeSnapshotId derivado del fingerprint.', async () => {
    const input = await baseSealingInput()
    const sealed = await sealCanonicalKnowledgeDocument(input)
    expect(sealed.knowledgeSnapshotId).toBe(
      `knowledge-snapshot:${input.fingerprint.fingerprintVersion}:${input.fingerprint.value}`,
    )
  })

  it('11. KnowledgeSnapshotKey estable.', async () => {
    const document = baseCanonicalDocument()
    const keyA = deriveKnowledgeSnapshotKey(document)
    const keyB = deriveKnowledgeSnapshotKey(document)
    expect(keyA).toBe(keyB)
  })

  it('12. Revision 1 valida.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.revision).toBe(1)
  })

  it('13. Revision 0 rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({ ...input, revision: 0 }),
      'KNOWLEDGE_SEAL_INVALID_REVISION',
    )
  })

  it('14. Revision negativa rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({ ...input, revision: -1 }),
      'KNOWLEDGE_SEAL_INVALID_REVISION',
    )
  })

  it('15. Revision decimal rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({ ...input, revision: 1.5 }),
      'KNOWLEDGE_SEAL_INVALID_REVISION',
    )
  })

  it('16. Revision no segura rechazada.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          revision: Number.MAX_SAFE_INTEGER + 1,
        }),
      'KNOWLEDGE_SEAL_INVALID_REVISION',
    )
  })

  it('17. sealedAt valido preservado.', async () => {
    const input = await baseSealingInput()
    const sealed = await sealCanonicalKnowledgeDocument(input)
    expect(sealed.sealedAt).toBe(input.sealedAt)
  })

  it('18. sealedAt vacio rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          sealedAt: '' as UtcInstant,
        }),
      'KNOWLEDGE_SEAL_INVALID_TIME',
    )
  })

  it('19. sealedAt con formato invalido rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          sealedAt: '2026-07-16T10:30:00Z' as UtcInstant,
        }),
      'KNOWLEDGE_SEAL_INVALID_TIME',
    )
  })

  it('20. supersedes ausente en revision 1 valido.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.supersedesKnowledgeSnapshotId).toBeUndefined()
  })

  it('21. supersedes presente en revision 1 rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          supersedesKnowledgeSnapshotId:
            'knowledge-snapshot:knowledge-fingerprint/1.0.0:abc' as KnowledgeSnapshotId,
        }),
      'KNOWLEDGE_SEAL_INVALID_SUPERSEDES',
    )
  })

  it('22. supersedes ausente en revision > 1 rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () => sealCanonicalKnowledgeDocument({ ...input, revision: 2 }),
      'KNOWLEDGE_SEAL_INVALID_SUPERSEDES',
    )
  })

  it('23. supersedes valido preservado.', async () => {
    const input = await baseSealingInput()
    const supersedes = 'knowledge-snapshot:knowledge-fingerprint/1.0.0:prev' as KnowledgeSnapshotId
    const sealed = await sealCanonicalKnowledgeDocument({
      ...input,
      revision: 2,
      supersedesKnowledgeSnapshotId: supersedes,
    })
    expect(sealed.supersedesKnowledgeSnapshotId).toBe(supersedes)
  })

  it('24. supersedes vacio rechazado.', async () => {
    const input = await baseSealingInput()
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          revision: 2,
          supersedesKnowledgeSnapshotId: ' ' as KnowledgeSnapshotId,
        }),
      'KNOWLEDGE_SEAL_INVALID_SUPERSEDES',
    )
  })

  it('25. self-supersedes rechazado.', async () => {
    const input = await baseSealingInput()
    const selfId = `knowledge-snapshot:${input.fingerprint.fingerprintVersion}:${input.fingerprint.value}` as KnowledgeSnapshotId
    await expectSealError(
      () =>
        sealCanonicalKnowledgeDocument({
          ...input,
          revision: 2,
          supersedesKnowledgeSnapshotId: selfId,
        }),
      'KNOWLEDGE_SEAL_INVALID_SUPERSEDES',
    )
  })

  it('26. status siempre sealed.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.status).toBe('sealed')
  })

  it('27. No puede producir persisted.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.status).not.toBe('persisted')
  })

  it('28. No puede producir published.', async () => {
    const sealed = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    expect(sealed.status).not.toBe('published')
  })

  it('29. Input no mutado.', async () => {
    const input = await baseSealingInput()
    const before = structuredClone(input)
    void await sealCanonicalKnowledgeDocument(input)
    expect(input).toEqual(before)
  })

  it('30. Salida independiente.', async () => {
    const input = await baseSealingInput()
    const sealed = await sealCanonicalKnowledgeDocument(input)
    expect(sealed.canonicalDocument).not.toBe(input.canonicalDocument)
    expect(sealed.fingerprint).not.toBe(input.fingerprint)
    expect(sealed.facts).not.toBe(input.canonicalDocument.payload.facts)
  })

  it('31. Misma entrada produce mismo artefacto.', async () => {
    const input = await baseSealingInput()
    const a = await sealCanonicalKnowledgeDocument(input)
    const b = await sealCanonicalKnowledgeDocument(input)
    expect(a).toEqual(b)
  })

  it('32. Mismo documento produce mismo snapshotId.', async () => {
    const inputA = await baseSealingInput()
    const inputB = await baseSealingInput()
    const a = await sealCanonicalKnowledgeDocument(inputA)
    const b = await sealCanonicalKnowledgeDocument(inputB)
    expect(a.knowledgeSnapshotId).toBe(b.knowledgeSnapshotId)
  })

  it('33. Diferente documento produce distinto snapshotId.', async () => {
    const a = await sealCanonicalKnowledgeDocument(await baseSealingInput())
    const changedInput = await baseSealingInput()
    ;(changedInput.canonicalDocument.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${changedInput.canonicalDocument.payload.identity.knowledgeCollectionId}:different`
    const canonicalChanged = structuredClone(changedInput.canonicalDocument)
    const changedSealingInput: KnowledgeSealingInput = {
      ...changedInput,
      canonicalDocument: canonicalChanged,
      fingerprint: await fingerprintCanonicalKnowledgeDocument(canonicalChanged),
      knowledgeSnapshotKey: deriveKnowledgeSnapshotKey(canonicalChanged),
    }
    const b = await sealCanonicalKnowledgeDocument(changedSealingInput)
    expect(a.knowledgeSnapshotId).not.toBe(b.knowledgeSnapshotId)
  })

  it('34. Mismo key con distinta revisión conserva key.', async () => {
    const input = await baseSealingInput()
    const first = await sealCanonicalKnowledgeDocument(input)
    const second = await sealCanonicalKnowledgeDocument({
      ...cloneInput(input),
      revision: 2,
      supersedesKnowledgeSnapshotId:
        'knowledge-snapshot:knowledge-fingerprint/1.0.0:previous-revision' as KnowledgeSnapshotId,
    })
    expect(second.knowledgeSnapshotKey).toBe(first.knowledgeSnapshotKey)
  })

  it('35. Mismo contenido con distinta revisión conserva snapshotId.', async () => {
    const input = await baseSealingInput()
    const first = await sealCanonicalKnowledgeDocument(input)
    const second = await sealCanonicalKnowledgeDocument({
      ...cloneInput(input),
      revision: 2,
      supersedesKnowledgeSnapshotId:
        'knowledge-snapshot:knowledge-fingerprint/1.0.0:previous-revision-2' as KnowledgeSnapshotId,
    })
    expect(second.knowledgeSnapshotId).toBe(first.knowledgeSnapshotId)
  })

  it('36. Null rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { canonicalDocument: unknown }).canonicalDocument = null
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('37. Undefined material rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { extra?: unknown }).extra = undefined
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('38. Date rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { extraDate?: Date }).extraDate = new Date('2026-07-16T00:00:00.000Z')
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('39. NaN rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { revision: number }).revision = Number.NaN
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('40. Infinity rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { revision: number }).revision = Number.POSITIVE_INFINITY
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('41. BigInt rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { revision: bigint }).revision = BigInt(1)
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input as unknown as KnowledgeSealingInput),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('42. Function rechazada.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { fn?: () => void }).fn = () => {}
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('43. Symbol rechazado.', async () => {
    const input = await baseSealingInput()
    ;(input as unknown as { sym?: symbol }).sym = Symbol('x')
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('44. Prototipo personalizado rechazado.', async () => {
    const input = await baseSealingInput()
    const custom = Object.create({ invalid: true })
    custom.knowledgeSnapshotKey = input.knowledgeSnapshotKey
    custom.canonicalDocument = input.canonicalDocument
    custom.fingerprint = input.fingerprint
    custom.revision = input.revision
    custom.revisionReasonCode = input.revisionReasonCode
    custom.sealedAt = input.sealedAt

    await expectSealError(
      () => sealCanonicalKnowledgeDocument(custom as KnowledgeSealingInput),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('45. Ciclo rechazado.', async () => {
    const input = await baseSealingInput() as unknown as Record<string, unknown>
    input.self = input
    await expectSealError(
      () => sealCanonicalKnowledgeDocument(input as unknown as KnowledgeSealingInput),
      'KNOWLEDGE_SEAL_INVALID_VALUE',
    )
  })

  it('46. Error no expone contenido sensible.', async () => {
    const input = await baseSealingInput()
    const sensitive = input.fingerprint.value
    try {
      await sealCanonicalKnowledgeDocument({
        ...input,
        fingerprint: { ...input.fingerprint, value: '0'.repeat(64) },
      })
      throw new Error('Expected KnowledgeSealError')
    } catch (error) {
      expect((error as Error).message).not.toContain(sensitive)
    }
  })

  it('47. Sin persistencia.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toMatch(/indexeddb|localstorage|sessionstorage/i)
    expect(source).not.toMatch(/db\.|table\.|repository\.(save|insert|update|delete)/i)
  })

  it('48. Sin Repository.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*repository[^'"]*['"]/i)
    expect(source).not.toMatch(/new\s+\w*Repository\b/)
  })

  it('49. Sin Dexie.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*dexie[^'"]*['"]/i)
  })

  it('50. Sin red.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('http://')
    expect(source).not.toContain('https://')
  })

  it('51. Sin reloj.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toContain('Date.now(')
    expect(source).not.toContain('new Date(')
  })

  it('52. Sin aleatoriedad.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toContain('Math.random(')
  })

  it('53. Sin Insight Engine.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*insight[^'"]*['"]/i)
    expect(source).not.toMatch(/new\s+\w*Insight\w*/)
  })

  it('54. Sin LLM.', () => {
    const source = readFileSync(sealerPath, 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*llm[^'"]*['"]/i)
    expect(source).not.toMatch(/openai|anthropic|gemini|mistral/i)
  })
})

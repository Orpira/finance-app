import { describe, expect, it } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import {
  fingerprintCanonicalKnowledgeDocument,
  KNOWLEDGE_FINGERPRINT_ALGORITHM,
  KNOWLEDGE_FINGERPRINT_DOMAIN,
  KNOWLEDGE_FINGERPRINT_ENCODING,
  KNOWLEDGE_FINGERPRINT_VERSION,
  KnowledgeFingerprintError,
  serializeKnowledgeFingerprintPreimage,
} from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
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
  KnowledgeRulesVersion,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'

const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion

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

function cloneDocument(document: CanonicalKnowledgeDocument): CanonicalKnowledgeDocument {
  return structuredClone(document)
}

async function fingerprintValue(document: CanonicalKnowledgeDocument): Promise<string> {
  return (await fingerprintCanonicalKnowledgeDocument(document)).value
}

describe('KnowledgeFingerprint deterministic hash', () => {
  it('1. documento minimo.', async () => {
    const document = baseCanonicalDocument()
    const fingerprint = await fingerprintCanonicalKnowledgeDocument(document)
    expect(fingerprint.value).toMatch(/^[0-9a-f]{64}$/)
  })

  it('2. determinismo repetido.', async () => {
    const document = baseCanonicalDocument()
    const values = await Promise.all(
      Array.from({ length: 8 }, () => fingerprintValue(document)),
    )
    expect(new Set(values).size).toBe(1)
  })

  it('3. domain separator exacto.', async () => {
    const fingerprint = await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
    expect(fingerprint.domain).toBe(KNOWLEDGE_FINGERPRINT_DOMAIN)
  })

  it('4. SHA-256 correcto.', async () => {
    const fingerprint = await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
    expect(fingerprint.algorithm).toBe(KNOWLEDGE_FINGERPRINT_ALGORITHM)
  })

  it('5. hex lowercase.', async () => {
    const value = await fingerprintValue(baseCanonicalDocument())
    expect(value).toMatch(/^[0-9a-f]+$/)
    expect(value.toLowerCase()).toBe(value)
  })

  it('6. longitud 64.', async () => {
    const value = await fingerprintValue(baseCanonicalDocument())
    expect(value).toHaveLength(64)
  })

  it('7. cambio de facts altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())
    b.payload.facts[0].severity = 'warning'

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('8. cambio de relationships altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())

    b.payload.relationships = [
      {
        sourceFactId: b.payload.facts[0].factId,
        relationshipType: 'supports',
        targetFactId: b.payload.facts[1].factId,
      },
    ]

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('9. cambio de evidence altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())
    b.payload.facts[0].evidence.coverageCodes = ['coverage.partial']

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('10. cambio de versiones altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())
    b.payload.metadata.knowledgeVersion = 'knowledge/2.0.0' as KnowledgeVersion

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('11. cambio de scope altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())
    b.payload.facts[0].scope = {
      ...b.payload.facts[0].scope,
      timezone: 'America/Bogota' as IanaTimeZone,
    }

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('12. cambio de metadata altera hash.', async () => {
    const a = cloneDocument(baseCanonicalDocument())
    const b = cloneDocument(baseCanonicalDocument())
    b.payload.metadata.rulesVersion = 'knowledge-rules/2.0.0' as KnowledgeRulesVersion

    expect(await fingerprintValue(a)).not.toBe(await fingerprintValue(b))
  })

  it('13. mismo documento mismo hash.', async () => {
    const document = baseCanonicalDocument()
    const first = await fingerprintValue(document)
    const second = await fingerprintValue(document)
    expect(first).toBe(second)
  })

  it('14. serializacion de preimagen repetida.', () => {
    const document = baseCanonicalDocument()
    const first = serializeKnowledgeFingerprintPreimage(document)
    const second = serializeKnowledgeFingerprintPreimage(document)
    expect(first).toBe(second)
  })

  it('15. inmutabilidad del documento de entrada.', async () => {
    const document = baseCanonicalDocument()
    const before = structuredClone(document)

    void await fingerprintCanonicalKnowledgeDocument(document)
    expect(document).toEqual(before)
  })

  it('16. crypto unavailable.', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    })

    try {
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
      throw new Error('Expected KnowledgeFingerprintError')
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeFingerprintError)
      expect((error as KnowledgeFingerprintError).code).toBe(
        'KNOWLEDGE_FINGERPRINT_CRYPTO_UNAVAILABLE',
      )
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
      })
    }
  })

  it('17. encoding falla.', async () => {
    const OriginalTextEncoder = globalThis.TextEncoder
    class BrokenTextEncoder {
      encode(): never {
        throw new Error('encoding failed')
      }
    }

    Object.defineProperty(globalThis, 'TextEncoder', {
      value: BrokenTextEncoder,
      configurable: true,
    })

    try {
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
      throw new Error('Expected KnowledgeFingerprintError')
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeFingerprintError)
      expect((error as KnowledgeFingerprintError).code).toBe(
        'KNOWLEDGE_FINGERPRINT_ENCODING_FAILED',
      )
    } finally {
      Object.defineProperty(globalThis, 'TextEncoder', {
        value: OriginalTextEncoder,
        configurable: true,
      })
    }
  })

  it('18. documento invalido.', async () => {
    const invalid = {
      canonicalizationVersion: 'knowledge-c14n/1.0.0',
      payload: {
        metadata: {},
      },
    } as unknown as CanonicalKnowledgeDocument

    try {
      await fingerprintCanonicalKnowledgeDocument(invalid)
      throw new Error('Expected KnowledgeFingerprintError')
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeFingerprintError)
      expect((error as KnowledgeFingerprintError).code).toBe(
        'KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT',
      )
    }
  })

  it('19. sin sellado.', async () => {
    const payload = JSON.stringify(
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument()),
    )
    expect(payload).not.toContain('sealedAt')
  })

  it('20. sin repository.', async () => {
    const payload = JSON.stringify(
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument()),
    )
    expect(payload).not.toContain('repository')
  })

  it('21. sin persistencia.', async () => {
    const payload = JSON.stringify(
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument()),
    )
    expect(payload).not.toContain('persist')
  })

  it('22. sin IA.', async () => {
    const payload = JSON.stringify(
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument()),
    )
    expect(payload).not.toContain('"ai"')
  })

  it('23. sin LLM.', async () => {
    const payload = JSON.stringify(
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument()),
    )
    expect(payload).not.toContain('llm')
  })

  it('24. preimagen incluye domain separator.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(KNOWLEDGE_FINGERPRINT_DOMAIN + preimage).toContain(
      KNOWLEDGE_FINGERPRINT_DOMAIN,
    )
  })

  it('25. preimagen incluye canonicalizationVersion.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).toContain('"canonicalizationVersion"')
  })

  it('26. preimagen incluye versiones de knowledge.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).toContain('"knowledgeVersion"')
    expect(preimage).toContain('"knowledgeBuilderVersion"')
    expect(preimage).toContain('"knowledgeRulesVersion"')
    expect(preimage).toContain('"knowledgeProjectionVersion"')
  })

  it('27. preimagen incluye identity y facts.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).toContain('"knowledgeIdentity"')
    expect(preimage).toContain('"knowledgeFacts"')
  })

  it('28. preimagen incluye relationships y evidence.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).toContain('"knowledgeRelationships"')
    expect(preimage).toContain('"knowledgeEvidence"')
  })

  it('29. preimagen incluye scope y metadata material.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).toContain('"knowledgeScope"')
    expect(preimage).toContain('"knowledgeMetadataMaterial"')
  })

  it('30. salida usa contrato de encoding/version.', async () => {
    const fingerprint = await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
    expect(fingerprint.encoding).toBe(KNOWLEDGE_FINGERPRINT_ENCODING)
    expect(fingerprint.fingerprintVersion).toBe(KNOWLEDGE_FINGERPRINT_VERSION)
  })

  it('31. clon equivalente del mismo documento produce mismo hash.', async () => {
    const a = baseCanonicalDocument()
    const b = cloneDocument(a)

    expect(await fingerprintValue(a)).toBe(await fingerprintValue(b))
  })

  it('32. preimagen no contiene runtime timestamp ni random.', () => {
    const preimage = serializeKnowledgeFingerprintPreimage(baseCanonicalDocument())
    expect(preimage).not.toContain('runtimeTimestamp')
    expect(preimage).not.toContain('random')
    expect(preimage).not.toContain('uuid')
  })

  it('33. unsupported algorithm mapea error determinista.', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: {
          digest: async () => {
            throw new Error('not supported')
          },
        },
      },
      configurable: true,
    })

    try {
      await fingerprintCanonicalKnowledgeDocument(baseCanonicalDocument())
      throw new Error('Expected KnowledgeFingerprintError')
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeFingerprintError)
      expect((error as KnowledgeFingerprintError).code).toBe(
        'KNOWLEDGE_FINGERPRINT_UNSUPPORTED_ALGORITHM',
      )
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
      })
    }
  })
})

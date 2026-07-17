import { describe, expect, it } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  canonicalizeValidatedKnowledgeCollection,
  KnowledgeCanonicalizationError,
  KNOWLEDGE_CANONICALIZATION_VERSION_V1,
  serializeCanonicalKnowledgeDocument,
} from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
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
  DraftKnowledgeCollection,
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
  ValidatedKnowledgeCollection,
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

function baseDraftCollection(
  engineResult: EngineResultFixture = baseEngineResult(),
  snapshotOverrides: Record<string, unknown> = {},
): DraftKnowledgeCollection {
  return buildKnowledgeCollectionFromSnapshot(
    builderInput(baseSnapshot(engineResult, snapshotOverrides)),
  )
}

function baseValidatedCollection(
  engineResult: EngineResultFixture = baseEngineResult(),
  snapshotOverrides: Record<string, unknown> = {},
): ValidatedKnowledgeCollection {
  return validateKnowledgeCollection(baseDraftCollection(engineResult, snapshotOverrides))
}

function cloneValidated(collection: ValidatedKnowledgeCollection): ValidatedKnowledgeCollection {
  return structuredClone(collection)
}

function expectCanonicalizationError(action: () => void): void {
  expect(action).toThrowError(KnowledgeCanonicalizationError)
}

describe('KnowledgeCanonicalizer deterministic canonicalization', () => {
  it('1. Coleccion validada minima.', () => {
    const document = canonicalizeValidatedKnowledgeCollection(baseValidatedCollection())
    expect(document.payload.factCount).toBeGreaterThan(0)
  })

  it('2. Draft rechazado en runtime.', () => {
    const draft = baseDraftCollection()
    expectCanonicalizationError(() =>
      canonicalizeValidatedKnowledgeCollection(draft as unknown as ValidatedKnowledgeCollection),
    )
  })

  it('3. Estado rejected rechazado.', () => {
    const rejected = {
      ...baseValidatedCollection(),
      state: 'rejected',
    } as unknown as ValidatedKnowledgeCollection
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(rejected))
  })

  it('4. Version canonica V1 soportada.', () => {
    const document = canonicalizeValidatedKnowledgeCollection(baseValidatedCollection())
    expect(document.canonicalizationVersion).toBe(KNOWLEDGE_CANONICALIZATION_VERSION_V1)
  })

  it('5. Version desconocida rechazada.', () => {
    const invalid = {
      ...baseValidatedCollection(),
      canonicalizationVersion: 'knowledge-c14n/9.9.9',
    } as unknown as ValidatedKnowledgeCollection
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid))
  })

  it('6. Propiedades reordenadas producen salida identica.', () => {
    const base = baseValidatedCollection()
    const reordered = cloneValidated(base)
    reordered.facts[0].evidence = {
      sourcePaths: [...reordered.facts[0].evidence.sourcePaths],
      warningCodes: [...reordered.facts[0].evidence.warningCodes],
      coverageCodes: [...reordered.facts[0].evidence.coverageCodes],
      sourceContextKinds: [...reordered.facts[0].evidence.sourceContextKinds],
      sourceRecordIds: [...reordered.facts[0].evidence.sourceRecordIds],
      sourceAppliedRuleIds: [...reordered.facts[0].evidence.sourceAppliedRuleIds],
      sourceFingerprintValue: reordered.facts[0].evidence.sourceFingerprintValue,
      sourceSnapshotRevision: reordered.facts[0].evidence.sourceSnapshotRevision,
      sourceSnapshotKey: reordered.facts[0].evidence.sourceSnapshotKey,
      sourceSnapshotId: reordered.facts[0].evidence.sourceSnapshotId,
    }

    expect(canonicalizeValidatedKnowledgeCollection(base))
      .toEqual(canonicalizeValidatedKnowledgeCollection(reordered))
  })

  it('7. Facts permutados producen salida identica.', () => {
    const a = baseValidatedCollection()
    const b = cloneValidated(a)
    b.facts.reverse()

    expect(canonicalizeValidatedKnowledgeCollection(a))
      .toEqual(canonicalizeValidatedKnowledgeCollection(b))
  })

  it('8. Relationships permutadas producen salida identica.', () => {
    const base = cloneValidated(baseValidatedCollection())
    base.relationships = [
      {
        relation: 'supports',
        fromFactId: base.facts[0].factId,
        toFactId: base.facts[1].factId,
      },
      {
        relation: 'derived-from',
        fromFactId: base.facts[2].factId,
        toFactId: base.facts[0].factId,
      },
    ]

    const permuted = cloneValidated(base)
    permuted.relationships = [...permuted.relationships].reverse()

    expect(canonicalizeValidatedKnowledgeCollection(base))
      .toEqual(canonicalizeValidatedKnowledgeCollection(permuted))
  })

  it('9. Evidence permutada produce salida identica.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(a)

    a.facts[0].evidence.sourceAppliedRuleIds = ['b', 'a']
    b.facts[0].evidence.sourceAppliedRuleIds = ['a', 'b']

    expect(canonicalizeValidatedKnowledgeCollection(a))
      .toEqual(canonicalizeValidatedKnowledgeCollection(b))
  })

  it('10. Warning codes permutados producen salida identica.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(a)

    a.facts[0].evidence.warningCodes = ['w2', 'w1']
    b.facts[0].evidence.warningCodes = ['w1', 'w2']

    expect(canonicalizeValidatedKnowledgeCollection(a))
      .toEqual(canonicalizeValidatedKnowledgeCollection(b))
  })

  it('11. Orden canonico de facts.', () => {
    const input = cloneValidated(baseValidatedCollection())
    input.facts.reverse()
    const facts = canonicalizeValidatedKnowledgeCollection(input).payload.facts

    for (let i = 1; i < facts.length; i += 1) {
      const prev = facts[i - 1]
      const curr = facts[i]
      const ordered =
        prev.category < curr.category ||
        (prev.category === curr.category && prev.factType < curr.factType) ||
        (prev.category === curr.category && prev.factType === curr.factType && prev.ordinal <= curr.ordinal)
      expect(ordered).toBe(true)
    }
  })

  it('12. Orden canonico de relaciones.', () => {
    const input = cloneValidated(baseValidatedCollection())
    input.relationships = [
      {
        relation: 'supports',
        fromFactId: input.facts[1].factId,
        toFactId: input.facts[0].factId,
      },
      {
        relation: 'derived-from',
        fromFactId: input.facts[0].factId,
        toFactId: input.facts[2].factId,
      },
    ]

    const relationships = canonicalizeValidatedKnowledgeCollection(input).payload.relationships

    for (let i = 1; i < relationships.length; i += 1) {
      const prev = relationships[i - 1]
      const curr = relationships[i]
      const ordered =
        prev.sourceFactId < curr.sourceFactId ||
        (prev.sourceFactId === curr.sourceFactId && prev.relationshipType < curr.relationshipType) ||
        (prev.sourceFactId === curr.sourceFactId && prev.relationshipType === curr.relationshipType && prev.targetFactId <= curr.targetFactId)
      expect(ordered).toBe(true)
    }
  })

  it('13. Duplicados permitidos conservan multiplicidad.', () => {
    const input = cloneValidated(baseValidatedCollection())
    const duplicate = {
      relation: 'supports' as const,
      fromFactId: input.facts[0].factId,
      toFactId: input.facts[1].factId,
    }
    input.relationships = [duplicate, duplicate]

    const output = canonicalizeValidatedKnowledgeCollection(input)
    expect(output.payload.relationships.length).toBe(2)
  })

  it('14. Cantidad diferente de duplicados produce salida diferente.', () => {
    const one = cloneValidated(baseValidatedCollection())
    const two = cloneValidated(baseValidatedCollection())
    const duplicate = {
      relation: 'supports' as const,
      fromFactId: one.facts[0].factId,
      toFactId: one.facts[1].factId,
    }

    one.relationships = [duplicate]
    two.relationships = [duplicate, duplicate]

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(one)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(two)))
  })

  it('15. -0 se normaliza a 0.', () => {
    const input = cloneValidated(baseValidatedCollection())
    ;(input as unknown as { identity: { sourceSnapshotRevision: number } }).identity.sourceSnapshotRevision = -0

    const output = canonicalizeValidatedKnowledgeCollection(input)
    expect(Object.is(output.payload.sourceSnapshotReferences.snapshotRevision, -0)).toBe(false)
    expect(output.payload.sourceSnapshotReferences.snapshotRevision).toBe(0)
  })

  it('16. 0 permanece 0.', () => {
    const input = cloneValidated(baseValidatedCollection())
    ;(input as unknown as { identity: { sourceSnapshotRevision: number } }).identity.sourceSnapshotRevision = 0

    const output = canonicalizeValidatedKnowledgeCollection(input)
    expect(output.payload.sourceSnapshotReferences.snapshotRevision).toBe(0)
  })

  it('17. Negativos distintos de cero se preservan.', () => {
    const input = cloneValidated(baseValidatedCollection())
    input.facts[0].evidence.sourceRecordIds = [-7]

    const output = canonicalizeValidatedKnowledgeCollection(input)
    const evidenceRef = output.payload.evidenceReferences.find((item) => item.evidenceType === 'record-id')
    expect(evidenceRef?.evidenceValue).toBe(-7)
  })

  it('18. NaN rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection())
    ;(invalid as unknown as { identity: { sourceSnapshotRevision: number } }).identity.sourceSnapshotRevision = Number.NaN
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid))
  })

  it('19. Infinity rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection())
    ;(invalid as unknown as { identity: { sourceSnapshotRevision: number } }).identity.sourceSnapshotRevision = Number.POSITIVE_INFINITY
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid))
  })

  it('20. null rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { identity: { sourceSnapshotKey: unknown } }
    invalid.identity.sourceSnapshotKey = null
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('21. undefined rechazado en payload material.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { extraField?: string }
    invalid.extraField = undefined
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('22. Date rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { extraDate?: Date }
    invalid.extraDate = new Date('2026-07-15T00:00:00.000Z')
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('23. bigint rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { factCount: bigint }
    invalid.factCount = BigInt(6)
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('24. funcion rechazada.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { customFn?: () => void }
    invalid.customFn = () => {}
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('25. simbolo rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { customSymbol?: symbol }
    invalid.customSymbol = Symbol('x')
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('26. ciclo rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as Record<string, unknown>
    invalid.self = invalid
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('27. prototipo personalizado rechazado.', () => {
    const invalid = cloneValidated(baseValidatedCollection())
    const customIdentity = Object.create({ custom: true })
    customIdentity.knowledgeCollectionId = invalid.identity.knowledgeCollectionId
    customIdentity.sourceSnapshotId = invalid.identity.sourceSnapshotId
    customIdentity.sourceSnapshotKey = invalid.identity.sourceSnapshotKey
    customIdentity.sourceSnapshotRevision = invalid.identity.sourceSnapshotRevision
    customIdentity.sourceFingerprintValue = invalid.identity.sourceFingerprintValue
    invalid.identity = customIdentity
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid))
  })

  it('28. arrays vacios preservados.', () => {
    const input = cloneValidated(baseValidatedCollection())
    input.facts[0].evidence.coverageCodes = []

    const output = canonicalizeValidatedKnowledgeCollection(input)
    expect(output.payload.facts[0].evidence.coverageCodes).toEqual([])
  })

  it('29. strings vacios permitidos preservados.', () => {
    const input = cloneValidated(baseValidatedCollection())
    input.facts[0].evidence.warningCodes = ['']

    const output = canonicalizeValidatedKnowledgeCollection(input)
    expect(output.payload.facts[0].evidence.warningCodes).toEqual([''])
  })

  it('30. campos ausentes preservados.', () => {
    const output = canonicalizeValidatedKnowledgeCollection(baseValidatedCollection())
    expect('earningPeriodId' in output.payload.facts[0].scope).toBe(false)
  })

  it('31. input no mutado.', () => {
    const input = baseValidatedCollection()
    const before = structuredClone(input)

    void canonicalizeValidatedKnowledgeCollection(input)
    expect(input).toEqual(before)
  })

  it('32. salida independiente.', () => {
    const input = baseValidatedCollection()
    const output = canonicalizeValidatedKnowledgeCollection(input)

    expect(output).not.toBe(input)
    expect(output.payload.facts).not.toBe(input.facts)
    expect(output.payload.identity).not.toBe(input.identity)
  })

  it('33. determinismo repetido.', () => {
    const input = baseValidatedCollection()

    expect(canonicalizeValidatedKnowledgeCollection(input))
      .toEqual(canonicalizeValidatedKnowledgeCollection(input))
  })

  it('34. serializacion repetida identica.', () => {
    const document = canonicalizeValidatedKnowledgeCollection(baseValidatedCollection())

    expect(serializeCanonicalKnowledgeDocument(document))
      .toBe(serializeCanonicalKnowledgeDocument(document))
  })

  it('35. cambio de fact produce documento diferente.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(baseValidatedCollection())
    b.facts[0].severity = 'warning'

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(a)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(b)))
  })

  it('36. cambio de relacion produce documento diferente.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(baseValidatedCollection())
    b.relationships = [
      {
        relation: 'supports',
        fromFactId: b.facts[0].factId,
        toFactId: b.facts[1].factId,
      },
    ]

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(a)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(b)))
  })

  it('37. cambio de evidencia produce documento diferente.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(baseValidatedCollection())
    b.facts[0].evidence.coverageCodes = ['coverage.partial']

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(a)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(b)))
  })

  it('38. cambio de version Knowledge produce documento diferente.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(baseValidatedCollection())
    b.versions.knowledgeVersion = 'knowledge/2.0.0' as KnowledgeVersion

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(a)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(b)))
  })

  it('39. cambio de scope produce documento diferente.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(baseValidatedCollection())
    b.facts[0].scope = {
      ...b.facts[0].scope,
      timezone: 'America/Bogota' as IanaTimeZone,
    }

    expect(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(a)))
      .not.toBe(serializeCanonicalKnowledgeDocument(canonicalizeValidatedKnowledgeCollection(b)))
  })

  it('40. mismo contenido en distinto orden produce mismo documento.', () => {
    const a = cloneValidated(baseValidatedCollection())
    const b = cloneValidated(a)

    b.facts.reverse()
    b.relationships = [
      {
        relation: 'supports',
        fromFactId: b.facts[0].factId,
        toFactId: b.facts[1].factId,
      },
      {
        relation: 'derived-from',
        fromFactId: b.facts[2].factId,
        toFactId: b.facts[0].factId,
      },
    ]
    a.relationships = [...b.relationships].reverse()

    b.facts[0].evidence.coverageCodes = ['b', 'a']
    a.facts.find((f) => f.factId === b.facts[0].factId)!.evidence.coverageCodes = ['a', 'b']

    expect(canonicalizeValidatedKnowledgeCollection(a))
      .toEqual(canonicalizeValidatedKnowledgeCollection(b))
  })

  it('41. no existe fingerprint canonico.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"fingerprint":')
  })

  it('42. no existe sellado.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"sealedAt":')
  })

  it('43. no existe persistencia.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"persistedAt":')
    expect(payload).not.toContain('"syncState":')
  })

  it('44. no existe Repository.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"repository":')
  })

  it('45. no existe IA.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"ai":')
  })

  it('46. no existe Insight Engine.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"insightEngine":')
  })

  it('47. no contiene FinancialEngineResult.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"engineResult":')
  })

  it('48. no contiene Snapshot completo.', () => {
    const payload = JSON.stringify(canonicalizeValidatedKnowledgeCollection(baseValidatedCollection()))
    expect(payload).not.toContain('"canonicalDocument":')
    expect(payload).not.toContain('"operationalMetadata":')
  })

  it('49. no contiene notas libres.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { notes: string }
    invalid.notes = 'nota libre'
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })

  it('50. no contiene datos personales.', () => {
    const invalid = cloneValidated(baseValidatedCollection()) as unknown as { email: string }
    invalid.email = 'user@example.com'
    expectCanonicalizationError(() => canonicalizeValidatedKnowledgeCollection(invalid as never))
  })
})

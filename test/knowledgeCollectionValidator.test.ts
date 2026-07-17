import { describe, expect, it } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  KnowledgeValidationError,
  validateKnowledgeCollection,
} from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
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
  KnowledgeFact,
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

function baseDraftCollection(
  engineResult: EngineResultFixture = baseEngineResult(),
  snapshotOverrides: Record<string, unknown> = {},
): DraftKnowledgeCollection {
  return buildKnowledgeCollectionFromSnapshot(
    builderInput(baseSnapshot(engineResult, snapshotOverrides)),
  )
}

function cloneDraft(draft: DraftKnowledgeCollection): DraftKnowledgeCollection {
  return structuredClone(draft)
}

function expectValidationError(action: () => void): void {
  expect(action).toThrowError(KnowledgeValidationError)
}

function replaceFact(
  draft: DraftKnowledgeCollection,
  index: number,
  changes: Partial<KnowledgeFact>,
): DraftKnowledgeCollection {
  const changed = cloneDraft(draft)
  changed.facts[index] = {
    ...changed.facts[index],
    ...changes,
  }
  return changed
}

describe('KnowledgeCollectionValidator deterministic validator', () => {
  it('1. Coleccion valida minima.', () => {
    const validated = validateKnowledgeCollection(baseDraftCollection())
    expect(validated.state).toBe('validated')
    expect(validated.validation.status).toBe('valid')
  })

  it('2. Draft a validated.', () => {
    const draft = baseDraftCollection()
    const validated = validateKnowledgeCollection(draft)
    expect(draft.state).toBe('draft')
    expect(validated.state).toBe('validated')
  })

  it('3. Validated como entrada rechazado.', () => {
    const validated = validateKnowledgeCollection(baseDraftCollection())
    expectValidationError(() =>
      validateKnowledgeCollection(validated as unknown as DraftKnowledgeCollection),
    )
  })

  it('4. Estado invalido rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection()) as DraftKnowledgeCollection & { state: string }
    invalid.state = 'unknown'
    expectValidationError(() => validateKnowledgeCollection(invalid as DraftKnowledgeCollection))
  })

  it('5. Version Knowledge incompatible.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.versions = {
      ...invalid.versions,
      knowledgeVersion: 'knowledge/9.9.9' as KnowledgeVersion,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('6. Builder version incompatible.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.versions = {
      ...invalid.versions,
      builderVersion: 'knowledge-builder/9.9.9' as KnowledgeBuilderVersion,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('7. Rules version incompatible.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.versions = {
      ...invalid.versions,
      rulesVersion: 'knowledge-rules/9.9.9' as KnowledgeRulesVersion,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('8. Projection version incompatible.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.versions = {
      ...invalid.versions,
      projectionVersion: 'knowledge-projection/9.9.9' as KnowledgeProjectionVersion,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('9. Identity vacia.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      knowledgeCollectionId: '' as typeof invalid.identity.knowledgeCollectionId,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('10. Snapshot reference vacia.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceSnapshotId: '' as typeof invalid.identity.sourceSnapshotId,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('11. Facts vacios rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts = []
    invalid.factCount = 0
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('11b. SnapshotKey vacio rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceSnapshotKey: '' as typeof invalid.identity.sourceSnapshotKey,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('11c. Fingerprint vacio rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceFingerprintValue: '',
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('11d. Revision negativa rechazada.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceSnapshotRevision: -1,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('12. ID duplicado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts[1] = {
      ...invalid.facts[1],
      factId: invalid.facts[0].factId,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('13. ID con formato invalido.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, {
      factId: 'invalid-id' as never,
    })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('14. Fact type desconocido.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, {
      factType: 'income.unknown' as never,
    })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('15. Category incompatible.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, { category: 'income' })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('16. Severity incompatible.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, { severity: 'critical' })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('17. Confidence incompatible.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, { confidence: 'high' as never })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('18. Orden incorrecto.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;[invalid.facts[0], invalid.facts[1]] = [invalid.facts[1], invalid.facts[0]]
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('19. Ordinal no contiguo.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, {
      factId: baseDraftCollection().facts[0].factId.replace(/\d{4}$/, '0003') as never,
    })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('20. Evidence invalida.', () => {
    const invalid = replaceFact(baseDraftCollection(), 0, {
      evidence: {
        ...baseDraftCollection().facts[0].evidence,
        sourceSnapshotId: 'other-snapshot-id' as never,
      },
    })
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('21. Relationship a fact inexistente.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.relationships = [
      {
        relation: 'supports',
        fromFactId: invalid.facts[0].factId,
        toFactId: 'knowledge-fact:unknown:unknown:income.present:0001' as never,
      },
    ]
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('22. Relacion auto-referenciada invalida.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.relationships = [
      {
        relation: 'supports',
        fromFactId: invalid.facts[0].factId,
        toFactId: invalid.facts[0].factId,
      },
    ]
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('22b. Tipo de relationship invalido.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.relationships = [
      {
        relation: 'causes' as never,
        fromFactId: invalid.facts[0].factId,
        toFactId: invalid.facts[1].factId,
      },
    ]
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('23. Contradiccion balance.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'balance.negative')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'balance.positive:0006') as never,
      factType: 'balance.positive',
      category: 'balance',
      severity: 'info',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('24. Contradiccion income.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'income.present')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'income.absent:0006') as never,
      factType: 'income.absent',
      category: 'income',
      severity: 'info',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('25. Contradiccion expense.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'expense.present')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'expense.absent:0006') as never,
      factType: 'expense.absent',
      category: 'expense',
      severity: 'info',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('26. Contradiccion adjustment.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'adjustment.absent')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'adjustment.present:0006') as never,
      factType: 'adjustment.present',
      category: 'adjustment',
      severity: 'info',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('27. Contradiccion cashflow.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'cashflow.positive')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'cashflow.negative:0006') as never,
      factType: 'cashflow.negative',
      category: 'cashflow',
      severity: 'warning',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('28. Contradiccion period.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.facts.push({
      ...invalid.facts.find((fact) => fact.factType === 'period.non_empty')!,
      factId: invalid.facts[0].factId.replace('adjustment.absent:0000', 'period.empty:0006') as never,
      factType: 'period.empty',
      category: 'period',
      severity: 'info',
    })
    invalid.factCount = invalid.facts.length
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('29. period.empty incoherente.', () => {
    const emptyDraft = baseDraftCollection(
      baseEngineResult({
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
        balanceReport: {
          hasData: false,
          generalBalance: 0,
          netProfit: 0,
        },
      }),
      {
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
      },
    )
    const invalid = cloneDraft(emptyDraft)
    const incomeIndex = invalid.facts.findIndex((fact) => fact.factType === 'income.absent')
    invalid.facts[incomeIndex] = {
      ...invalid.facts[incomeIndex],
      factType: 'income.present',
      category: 'income',
      factId: invalid.facts[incomeIndex].factId.replace('income.absent', 'income.present') as never,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('30. period.non_empty incoherente.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    const incomeIndex = invalid.facts.findIndex((fact) => fact.factType === 'income.present')
    const expenseIndex = invalid.facts.findIndex((fact) => fact.factType === 'expense.present')
    const adjustmentIndex = invalid.facts.findIndex((fact) => fact.factType === 'adjustment.absent')

    invalid.facts[incomeIndex] = {
      ...invalid.facts[incomeIndex],
      factType: 'income.absent',
      factId: invalid.facts[incomeIndex].factId.replace('income.present', 'income.absent') as never,
      category: 'income',
      severity: 'info',
    }
    invalid.facts[expenseIndex] = {
      ...invalid.facts[expenseIndex],
      factType: 'expense.absent',
      factId: invalid.facts[expenseIndex].factId.replace('expense.present', 'expense.absent') as never,
      category: 'expense',
      severity: 'info',
    }
    invalid.facts[adjustmentIndex] = {
      ...invalid.facts[adjustmentIndex],
      factType: 'adjustment.absent',
      factId: invalid.facts[adjustmentIndex].factId.replace('adjustment.absent', 'adjustment.absent') as never,
      category: 'adjustment',
      severity: 'info',
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('31. null rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection()) as unknown as Record<string, unknown>
    ;(invalid as { identity: Record<string, unknown> }).identity.sourceSnapshotKey = null
    expectValidationError(() => validateKnowledgeCollection(invalid as DraftKnowledgeCollection))
  })

  it('32. undefined rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { identity: Record<string, unknown> }).identity.sourceSnapshotKey = undefined
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('33. Date rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { dateField: Date }).dateField = new Date('2026-07-15T00:00:00.000Z')
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('34. NaN rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceSnapshotRevision: Number.NaN,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('35. Infinity rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = {
      ...invalid.identity,
      sourceSnapshotRevision: Number.POSITIVE_INFINITY,
    }
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('36. bigint rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { factCount: bigint }).factCount = BigInt(6)
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('37. funcion rechazada.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { customFn: () => void }).customFn = () => {}
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('38. simbolo rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { customSymbol: symbol }).customSymbol = Symbol('x')
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('39. prototipo personalizado rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    const customProto = Object.create({ custom: true })
    customProto.sourceSnapshotId = invalid.identity.sourceSnapshotId
    customProto.sourceSnapshotKey = invalid.identity.sourceSnapshotKey
    customProto.sourceSnapshotRevision = invalid.identity.sourceSnapshotRevision
    customProto.sourceFingerprintValue = invalid.identity.sourceFingerprintValue
    customProto.knowledgeCollectionId = invalid.identity.knowledgeCollectionId
    invalid.identity = customProto
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('39b. instancia de clase rechazada.', () => {
    class CustomIdentity {
      readonly knowledgeCollectionId: string
      readonly sourceSnapshotId: string
      readonly sourceSnapshotKey: string
      readonly sourceSnapshotRevision: number
      readonly sourceFingerprintValue: string

      constructor(draft: DraftKnowledgeCollection) {
        this.knowledgeCollectionId = draft.identity.knowledgeCollectionId
        this.sourceSnapshotId = draft.identity.sourceSnapshotId
        this.sourceSnapshotKey = draft.identity.sourceSnapshotKey
        this.sourceSnapshotRevision = draft.identity.sourceSnapshotRevision
        this.sourceFingerprintValue = draft.identity.sourceFingerprintValue
      }
    }

    const invalid = cloneDraft(baseDraftCollection())
    invalid.identity = new CustomIdentity(invalid) as never
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('39c. salida serializable JSON.', () => {
    const validated = validateKnowledgeCollection(baseDraftCollection())
    expect(() => JSON.stringify(validated)).not.toThrow()
  })

  it('40. ciclo rechazado.', () => {
    const invalid = cloneDraft(baseDraftCollection()) as unknown as Record<string, unknown>
    invalid.self = invalid
    expectValidationError(() => validateKnowledgeCollection(invalid as DraftKnowledgeCollection))
  })

  it('41. input no mutado.', () => {
    const draft = baseDraftCollection()
    const before = structuredClone(draft)
    void validateKnowledgeCollection(draft)
    expect(draft).toEqual(before)
  })

  it('42. output independiente.', () => {
    const draft = baseDraftCollection()
    const validated = validateKnowledgeCollection(draft)
    expect(validated).toEqual({
      ...draft,
      state: 'validated',
      validation: validated.validation,
    })
    expect(validated.facts).not.toBe(draft.facts)
    expect(validated.identity).not.toBe(draft.identity)
  })

  it('43. determinismo.', () => {
    const draft = baseDraftCollection()
    const a = validateKnowledgeCollection(draft)
    const b = validateKnowledgeCollection(draft)
    expect(a).toEqual(b)
  })

  it('44. no contiene engineResult.', () => {
    const payload = JSON.stringify(validateKnowledgeCollection(baseDraftCollection()))
    expect(payload).not.toContain('"engineResult":')
  })

  it('45. no contiene canonical snapshot.', () => {
    const payload = JSON.stringify(validateKnowledgeCollection(baseDraftCollection()))
    expect(payload).not.toContain('"canonicalDocument":')
  })

  it('46. no contiene notas.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { notes: string }).notes = 'nota libre'
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('47. no contiene PII.', () => {
    const invalid = cloneDraft(baseDraftCollection())
    ;(invalid as unknown as { email: string }).email = 'user@example.com'
    expectValidationError(() => validateKnowledgeCollection(invalid))
  })

  it('48. modo Basico valido.', () => {
    const validated = validateKnowledgeCollection(baseDraftCollection())
    expect(validated.facts.every((fact) => fact.context.usageMode === 'basic')).toBe(true)
  })

  it('49. modo Profesional valido.', () => {
    const professionalDraft = baseDraftCollection(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        usageMode: 'professional',
      },
    })
    const validated = validateKnowledgeCollection(professionalDraft)
    expect(validated.facts.every((fact) => fact.context.usageMode === 'professional')).toBe(true)
  })

  it('50. temporada activa valida.', () => {
    const seasonDraft = baseDraftCollection(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        earningPeriodId: 9,
      },
    })
    const validated = validateKnowledgeCollection(seasonDraft)
    expect(validated.facts.every((fact) => fact.scope.earningPeriodId === 9)).toBe(true)
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  buildKnowledgeCollectionFromSnapshot,
  KnowledgeBuilderError,
} from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
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
  KnowledgeBuilderVersion,
  KnowledgeBuilderInput,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const builderFilePath = resolve(
  __dirname,
  '../src/intelligence/knowledge-layer/knowledgeFactsBuilder.ts',
)

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

function baseEngineResult(
  overrides: Partial<EngineResultFixture> = {},
): EngineResultFixture {
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

function inputFrom(snapshot: SealedFinancialSnapshot<EngineResultFixture>):
  KnowledgeBuilderInput<EngineResultFixture> {
  return {
    snapshot,
    knowledgeVersion: KNOWLEDGE_VERSION,
    builderVersion: BUILDER_VERSION,
    rulesVersion: RULES_VERSION,
    projectionVersion: PROJECTION_VERSION,
  }
}

function factTypes(snapshot: SealedFinancialSnapshot<EngineResultFixture>): string[] {
  return buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot)).facts.map(
    (fact) => fact.factType,
  )
}

describe('KnowledgeFactsBuilder deterministic builder', () => {
  it('1. Snapshot valido minimo.', () => {
    const result = buildKnowledgeCollectionFromSnapshot(
      inputFrom(baseSnapshot(baseEngineResult())),
    )
    expect(result.factCount).toBeGreaterThan(0)
  })

  it('2. Balance positivo.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { generalBalance: 12 } }))),
    ).toContain('balance.positive')
  })

  it('3. Balance negativo.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { generalBalance: -12 } }))),
    ).toContain('balance.negative')
  })

  it('4. Balance neutral.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { generalBalance: 0 } }))),
    ).toContain('balance.neutral')
  })

  it('5. Income present.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ incomeCount: 1 })))).toContain(
      'income.present',
    )
  })

  it('6. Income absent.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ incomeCount: 0 })))).toContain(
      'income.absent',
    )
  })

  it('7. Expense present.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ expenseCount: 1 })))).toContain(
      'expense.present',
    )
  })

  it('8. Expense absent.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ expenseCount: 0 })))).toContain(
      'expense.absent',
    )
  })

  it('9. Adjustment present.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ adjustmentCount: 2 })))).toContain(
      'adjustment.present',
    )
  })

  it('10. Adjustment absent.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult({ adjustmentCount: 0 })))).toContain(
      'adjustment.absent',
    )
  })

  it('11. Cashflow positivo.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { netProfit: 4 } }))),
    ).toContain('cashflow.positive')
  })

  it('12. Cashflow negativo.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { netProfit: -4 } }))),
    ).toContain('cashflow.negative')
  })

  it('13. Cashflow neutral.', () => {
    expect(
      factTypes(baseSnapshot(baseEngineResult({ balanceReport: { netProfit: 0 } }))),
    ).toContain('cashflow.neutral')
  })

  it('14. Period empty.', () => {
    const snapshot = baseSnapshot(
      baseEngineResult({
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
        balanceReport: { hasData: false },
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
    expect(factTypes(snapshot)).toContain('period.empty')
  })

  it('15. Period non_empty.', () => {
    expect(factTypes(baseSnapshot(baseEngineResult()))).toContain('period.non_empty')
  })

  it('16. Facts con IDs deterministas.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    for (const fact of result.facts) {
      expect(fact.factId).toContain(`knowledge-fact:${KNOWLEDGE_VERSION}`)
      expect(fact.factId).toContain(snapshot.identity.snapshotId)
    }
  })

  it('17. Mismo snapshot produce misma coleccion.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const a = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    const b = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(a).toEqual(b)
  })

  it('18. Orden estable.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const first = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot)).facts.map((f) => f.factId)
    const second = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot)).facts.map((f) => f.factId)
    expect(first).toEqual(second)
  })

  it('19. IDs unicos.', () => {
    const ids = buildKnowledgeCollectionFromSnapshot(inputFrom(baseSnapshot(baseEngineResult()))).facts
      .map((fact) => fact.factId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('20. Evidence referencia snapshot sin duplicarlo.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const fact = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot)).facts[0]
    expect(fact.evidence.sourceSnapshotId).toBe(snapshot.identity.snapshotId)
    expect(fact.evidence.sourceSnapshotKey).toBe(snapshot.identity.snapshotKey)
    expect(fact.evidence.sourceSnapshotRevision).toBe(snapshot.revision.revision)
  })

  it('21. No contiene FinancialEngineResult completo.', () => {
    const payload = JSON.stringify(
      buildKnowledgeCollectionFromSnapshot(inputFrom(baseSnapshot(baseEngineResult()))),
    )
    expect(payload).not.toContain('balanceReport')
    expect(payload).not.toContain('incomeCount')
    expect(payload).not.toContain('expenseCount')
    expect(payload).not.toContain('adjustmentCount')
  })

  it('22. No contiene canonicalDocument completo.', () => {
    const payload = JSON.stringify(
      buildKnowledgeCollectionFromSnapshot(inputFrom(baseSnapshot(baseEngineResult()))),
    )
    expect(payload).not.toContain('"canonicalDocument":')
    expect(payload).not.toContain('"operationalMetadata":')
  })

  it('23. Snapshot no mutado.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const before = structuredClone(snapshot)
    void buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(snapshot).toEqual(before)
  })

  it('24. Salida independiente.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const a = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    const b = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(a).toEqual(b)
    expect(a.facts).not.toBe(b.facts)
    expect(a.facts[0]).not.toBe(b.facts[0])
  })

  it('25. Versiones Knowledge separadas.', () => {
    const snapshot = baseSnapshot(baseEngineResult())
    const result = buildKnowledgeCollectionFromSnapshot({
      ...inputFrom(snapshot),
      knowledgeVersion: 'knowledge/9.9.9' as KnowledgeVersion,
      builderVersion: 'knowledge-builder/2.0.0' as KnowledgeBuilderVersion,
      rulesVersion: 'knowledge-rules/3.0.0' as KnowledgeRulesVersion,
      projectionVersion: 'knowledge-projection/4.0.0' as KnowledgeProjectionVersion,
    })
    expect(result.facts[0].factId).toContain('knowledge/9.9.9')
  })

  it('26. Snapshot status invalido rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), { status: 'persisted' })
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('27. Snapshot ID vacio rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      identity: { snapshotId: '', snapshotKey: 'k' },
    })
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('28. Fingerprint ausente rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), { fingerprint: { value: '' } })
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('29. NaN rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult({ balanceReport: { generalBalance: Number.NaN } }))
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('30. Infinity rechazado.', () => {
    const snapshot = baseSnapshot(
      baseEngineResult({ balanceReport: { generalBalance: Number.POSITIVE_INFINITY } }),
    )
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('31. null rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      canonicalDocument: {
        payload: {
          engineResult: {
            ...baseEngineResult(),
            balanceReport: {
              ...baseEngineResult().balanceReport,
              netProfit: null,
            },
          },
        },
      },
    })
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('32. Date rechazado.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      canonicalDocument: {
        payload: {
          engineResult: {
            ...baseEngineResult(),
            balanceReport: {
              ...baseEngineResult().balanceReport,
              netProfit: new Date(),
            },
          },
        },
      },
    })
    expect(() => buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))).toThrowError(
      KnowledgeBuilderError,
    )
  })

  it('33. Fact types desconocidos no generados.', () => {
    const generated = new Set(
      factTypes(baseSnapshot(baseEngineResult())),
    )
    expect(generated.has('income.increased')).toBe(false)
    expect(generated.has('expense.increased')).toBe(false)
    expect(generated.has('income.volatile')).toBe(false)
    expect(generated.has('season.started')).toBe(false)
  })

  it('34. Sin reloj.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('Date.now(')
    expect(source).not.toContain('new Date(')
  })

  it('35. Sin aleatoriedad.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('Math.random(')
  })

  it('36. Sin crypto.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('crypto')
  })

  it('37. Sin red.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('http://')
    expect(source).not.toContain('https://')
  })

  it('38. Sin Dexie.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('Dexie')
  })

  it('39. Sin Neon.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('neon')
    expect(source).not.toContain('Neon')
  })

  it('40. Sin n8n.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('n8n')
  })

  it('41. Sin WhatsApp.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('WhatsApp')
    expect(source).not.toContain('whatsapp')
  })

  it('42. Sin lenguaje natural.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('summary')
    expect(source).not.toContain('narrative')
  })

  it('43. Sin recomendaciones.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('recommend')
  })

  it('44. Sin persistencia.', () => {
    const source = readFileSync(builderFilePath, 'utf8')
    expect(source).not.toContain('persist')
    expect(source).not.toContain('repository')
  })

  it('45. Dataset vacio valido.', () => {
    const snapshot = baseSnapshot(
      baseEngineResult({
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
        balanceReport: { hasData: false, generalBalance: 0, netProfit: 0 },
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
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.factCount).toBeGreaterThan(0)
    expect(result.facts.map((fact) => fact.factType)).toContain('period.empty')
  })

  it('46. Modo Basico.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        usageMode: 'basic',
      },
    })
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.facts.every((fact) => fact.context.usageMode === 'basic')).toBe(true)
  })

  it('47. Modo Profesional.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        usageMode: 'professional',
      },
    })
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.facts.every((fact) => fact.context.usageMode === 'professional')).toBe(true)
  })

  it('48. Temporada activa.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        earningPeriodId: 9,
      },
    })
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.facts.every((fact) => fact.scope.earningPeriodId === 9)).toBe(true)
  })

  it('49. Valores historicos.', () => {
    const snapshot = baseSnapshot(baseEngineResult(), {
      scope: {
        ...baseSnapshot(baseEngineResult()).scope,
        periodStart: '2025-01-01',
        periodEndExclusive: '2025-02-01',
      },
    })
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.facts.every((fact) => fact.context.periodStart === '2025-01-01')).toBe(true)
  })

  it('50. Ajustes positivos y negativos.', () => {
    const snapshot = baseSnapshot(
      baseEngineResult({ adjustmentCount: 2 }),
      {
        evidence: {
          strategy: 'embedded-v1',
          records: [
            { sourceId: 'adj-pos', kind: 'income-adjustment' },
            { sourceId: 'adj-neg', kind: 'expense-adjustment' },
          ],
          context: [{ kind: 'settings-context' }],
          candidateRecordCount: 2,
          includedRecordCount: 2,
          excludedRecordCount: 0,
          coverageCodes: ['coverage.complete'],
          warningCodes: [],
        },
      },
    )
    const result = buildKnowledgeCollectionFromSnapshot(inputFrom(snapshot))
    expect(result.facts.map((fact) => fact.factType)).toContain('adjustment.present')
  })
})

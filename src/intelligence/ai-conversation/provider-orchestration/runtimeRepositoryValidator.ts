import {
  listServiceIncomes,
} from '../../../services/incomeService'
import {
  db,
} from '../../../database/db'
import {
  getFinancialTransactionsToolRuntimeMetadata,
} from '../../ai-tools/financial/transactionsTool'

const MOCK_HINTS = ['mock', 'fake', 'inmemory', 'fixture', 'demo'] as const

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface RuntimeRepositoryValidationResult {
  readonly incomeRepository: string
  readonly incomeInstanceId: string
  readonly transactionsToolRepository: string
  readonly transactionsToolInstanceId: string
  readonly sameInstance: boolean
  readonly hasRuntimeMocks: boolean
  readonly detectedRuntimeMockSymbols: readonly string[]
}

export function validateRuntimeRepositoryComposition(): RuntimeRepositoryValidationResult {
  const toolMetadata = getFinancialTransactionsToolRuntimeMetadata()
  const symbolCandidates = [
    toolMetadata.repositoryPath,
    toolMetadata.runtimeSource,
  ]

  const detectedRuntimeMockSymbols = symbolCandidates.filter((candidate) => {
    const normalized = normalize(candidate)
    return MOCK_HINTS.some((hint) => normalized.includes(hint))
  })

  return {
    incomeRepository: 'incomeService.listServiceIncomes -> db.services',
    incomeInstanceId: `db:${db.name}:table:${db.services.name}`,
    transactionsToolRepository: toolMetadata.repositoryPath,
    transactionsToolInstanceId: toolMetadata.repositoryInstanceId,
    sameInstance: Object.is(toolMetadata.listServiceIncomesRef, listServiceIncomes),
    hasRuntimeMocks: detectedRuntimeMockSymbols.length > 0,
    detectedRuntimeMockSymbols,
  }
}

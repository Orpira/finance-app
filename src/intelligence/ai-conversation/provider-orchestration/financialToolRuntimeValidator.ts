import {
  createTransactionsToolUseCase,
  getFinancialTransactionsToolRuntimeMetadata,
} from '../../ai-tools/financial/transactionsTool'

export interface FinancialToolRuntimeValidationResult {
  readonly toolId: 'financial_transactions'
  readonly repositoryUsed: string
  readonly repositoryInstanceId: string
  readonly recordCount: number
  readonly firstRecord: string | null
  readonly lastRecord: string | null
}

function toRecordPreview(record: unknown): string | null {
  if (record === null || record === undefined) {
    return null
  }

  try {
    return JSON.stringify(record)
  } catch {
    return '[unserializable-record]'
  }
}

export async function validateFinancialTransactionsToolRuntime(): Promise<FinancialToolRuntimeValidationResult> {
  const runtimeMetadata = getFinancialTransactionsToolRuntimeMetadata()
  const useCase = createTransactionsToolUseCase()
  const result = await useCase.execute({
    requestId: 'runtime-tool-validator',
    requestedAt: new Date().toISOString(),
    filters: {
      kinds: ['income'],
    },
    sort: {
      field: 'date',
      direction: 'desc',
    },
    limit: 2,
  })

  if (result.kind === 'failure') {
    return {
      toolId: 'financial_transactions',
      repositoryUsed: runtimeMetadata.repositoryPath,
      repositoryInstanceId: runtimeMetadata.repositoryInstanceId,
      recordCount: 0,
      firstRecord: null,
      lastRecord: null,
    }
  }

  const firstRecord = result.output.items[0] ?? null
  const lastRecord = result.output.items[result.output.items.length - 1] ?? null

  return {
    toolId: 'financial_transactions',
    repositoryUsed: runtimeMetadata.repositoryPath,
    repositoryInstanceId: runtimeMetadata.repositoryInstanceId,
    recordCount: result.output.items.length,
    firstRecord: toRecordPreview(firstRecord),
    lastRecord: toRecordPreview(lastRecord),
  }
}

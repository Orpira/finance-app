export interface RuntimeRepositoryAuditEntry {
  readonly timestamp: string
  readonly incomeRepository: string
  readonly incomeInstanceId: string
  readonly transactionsToolRepository: string
  readonly transactionsToolInstanceId: string
  readonly sameInstance: boolean
  readonly hasRuntimeMocks: boolean
  readonly detectedRuntimeMockSymbols: readonly string[]
}

export interface RuntimeProviderAuditEntry {
  readonly timestamp: string
  readonly strategy: 'mock' | 'openai'
  readonly providerExpected: string
  readonly providerSelected: string
  readonly model: string | null
  readonly openAICalled: boolean
  readonly fallbackUsed: boolean
  readonly reasonIfNotCalled: string | null
}

export interface RuntimeToolAuditEntry {
  readonly timestamp: string
  readonly toolId: string
  readonly repositoryInstanceId: string
  readonly recordCount: number
  readonly firstRecord: string | null
  readonly lastRecord: string | null
}

export interface RuntimePromptAuditEntry {
  readonly timestamp: string
  readonly provider: string
  readonly promptSize: number
  readonly contextSize: number
  readonly containsFinancialData: boolean
  readonly completionSize: number
}

export interface RuntimeResponseAuditEntry {
  readonly timestamp: string
  readonly provider: string
  readonly generatedByOpenAI: boolean
  readonly generatedByDeterministicComposer: boolean
  readonly messagePreview: string
}

interface RuntimeConversationAuditState {
  repository: RuntimeRepositoryAuditEntry[]
  provider: RuntimeProviderAuditEntry[]
  tool: RuntimeToolAuditEntry[]
  prompt: RuntimePromptAuditEntry[]
  response: RuntimeResponseAuditEntry[]
}

const runtimeAuditState: RuntimeConversationAuditState = {
  repository: [],
  provider: [],
  tool: [],
  prompt: [],
  response: [],
}

function shouldLogRuntimeAudit(): boolean {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
}

function pushLimited<T>(items: T[], value: T): void {
  items.push(value)
  if (items.length > 50) {
    items.shift()
  }
}

export function clearRuntimeConversationAudit(): void {
  runtimeAuditState.repository.length = 0
  runtimeAuditState.provider.length = 0
  runtimeAuditState.tool.length = 0
  runtimeAuditState.prompt.length = 0
  runtimeAuditState.response.length = 0
}

export function getRuntimeConversationAuditSnapshot(): RuntimeConversationAuditState {
  return {
    repository: runtimeAuditState.repository.slice(),
    provider: runtimeAuditState.provider.slice(),
    tool: runtimeAuditState.tool.slice(),
    prompt: runtimeAuditState.prompt.slice(),
    response: runtimeAuditState.response.slice(),
  }
}

export function recordRuntimeRepositoryAudit(entry: RuntimeRepositoryAuditEntry): void {
  pushLimited(runtimeAuditState.repository, entry)
  if (shouldLogRuntimeAudit()) {
    console.info('[PB-AUDIT][REPOSITORY]', {
      sameInstance: entry.sameInstance,
      incomeRepository: entry.incomeRepository,
      transactionsToolRepository: entry.transactionsToolRepository,
      incomeInstanceId: entry.incomeInstanceId,
      transactionsToolInstanceId: entry.transactionsToolInstanceId,
      hasRuntimeMocks: entry.hasRuntimeMocks,
      detectedRuntimeMockSymbols: entry.detectedRuntimeMockSymbols,
    })
  }
}

export function recordRuntimeProviderAudit(entry: RuntimeProviderAuditEntry): void {
  pushLimited(runtimeAuditState.provider, entry)
  if (shouldLogRuntimeAudit()) {
    console.info('[PB-AUDIT][PROVIDER]', {
      strategy: entry.strategy,
      providerExpected: entry.providerExpected,
      providerSelected: entry.providerSelected,
      model: entry.model,
      openAICalled: entry.openAICalled,
      fallbackUsed: entry.fallbackUsed,
      reasonIfNotCalled: entry.reasonIfNotCalled,
    })
  }
}

export function recordRuntimeToolAudit(entry: RuntimeToolAuditEntry): void {
  pushLimited(runtimeAuditState.tool, entry)
  if (shouldLogRuntimeAudit()) {
    console.info('[PB-AUDIT][TOOL]', {
      toolId: entry.toolId,
      repositoryInstanceId: entry.repositoryInstanceId,
      recordCount: entry.recordCount,
      firstRecord: entry.firstRecord,
      lastRecord: entry.lastRecord,
    })
  }
}

export function recordRuntimePromptAudit(entry: RuntimePromptAuditEntry): void {
  pushLimited(runtimeAuditState.prompt, entry)
  if (shouldLogRuntimeAudit()) {
    console.info('[PB-AUDIT][PROMPT]', {
      provider: entry.provider,
      promptSize: entry.promptSize,
      contextSize: entry.contextSize,
      containsFinancialData: entry.containsFinancialData,
      completionSize: entry.completionSize,
    })
  }
}

export function recordRuntimeResponseAudit(entry: RuntimeResponseAuditEntry): void {
  pushLimited(runtimeAuditState.response, entry)
  if (shouldLogRuntimeAudit()) {
    console.info('[PB-AUDIT][RESPONSE]', {
      provider: entry.provider,
      generatedByOpenAI: entry.generatedByOpenAI,
      generatedByDeterministicComposer: entry.generatedByDeterministicComposer,
      messagePreview: entry.messagePreview,
    })
  }
}

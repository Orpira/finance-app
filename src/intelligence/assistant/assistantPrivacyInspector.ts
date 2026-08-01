import type { AIPrivacyAuthorizationResult } from '../ai-foundation/aiFoundationContracts'

/**
 * Privacy Inspector (objetivo 10): registra qué se autorizó, con qué
 * proveedor y qué se excluyó — nunca valores financieros ni el texto del
 * usuario. En memoria (ring buffer), mismo criterio que assistantAuditLog.ts.
 */
export interface AssistantPrivacyInspectionEntry {
  readonly timestamp: string
  readonly requestId: string
  readonly decision: 'authorized' | 'rejected'
  readonly processingMode: 'LOCAL_ONLY' | 'EXTERNAL_PROVIDER'
  readonly categoriesIncluded: readonly string[]
  readonly categoriesExcluded: readonly string[]
  readonly failureCode?: string
}

const MAX_ENTRIES = 200
const entries: AssistantPrivacyInspectionEntry[] = []

const ALL_KNOWN_CATEGORIES = [
  'INSIGHT_SUMMARY',
  'INSIGHT_READ_MODEL',
  'FINANCIAL_SNAPSHOT',
  'KNOWLEDGE_COLLECTION',
  'USER_PROVIDED_TEXT',
  'APP_METADATA',
  'DIAGNOSTIC_METADATA',
] as const

export function recordPrivacyAuthorization(
  requestId: string,
  result: AIPrivacyAuthorizationResult,
): AssistantPrivacyInspectionEntry {
  const categoriesIncluded = result.ok
    ? result.envelope.authorizedCategories
    : result.traceability.categories
  const categoriesExcluded = ALL_KNOWN_CATEGORIES.filter(
    (category) => !categoriesIncluded.includes(category),
  )

  const entry: AssistantPrivacyInspectionEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    decision: result.ok ? 'authorized' : 'rejected',
    processingMode: result.ok ? result.envelope.processingMode : 'LOCAL_ONLY',
    categoriesIncluded,
    categoriesExcluded,
    ...(result.ok ? {} : { failureCode: result.code }),
  }

  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }

  return entry
}

export function getPrivacyInspectionTrail(): readonly AssistantPrivacyInspectionEntry[] {
  return [...entries]
}

export function clearPrivacyInspectionTrail(): void {
  entries.length = 0
}

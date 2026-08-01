import type { AssistantProposalKind, AssistantProposalStatus } from './assistantProposalContracts'

/**
 * Auditoría del Asistente: fecha, tipo, estado y resultado — nunca importes,
 * fechas de la operación, categorías, notas ni ningún otro dato financiero.
 * En memoria (ring buffer), no en Dexie: evita cualquier migración de
 * esquema para esta iteración y de todas formas su vida útil natural es la
 * sesión de la aplicación, no un histórico persistente.
 */
export interface AssistantAuditEntry {
  readonly timestamp: string
  readonly proposalId: string
  readonly kind: AssistantProposalKind
  readonly status: AssistantProposalStatus
  readonly executedRecordId?: number
  readonly failureCode?: string
}

const MAX_ENTRIES = 200
const entries: AssistantAuditEntry[] = []

export function recordAssistantAudit(entry: AssistantAuditEntry): void {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
}

export function getAssistantAuditTrail(): readonly AssistantAuditEntry[] {
  return [...entries]
}

export function clearAssistantAuditTrail(): void {
  entries.length = 0
}

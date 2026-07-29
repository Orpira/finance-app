export interface TrialGrantSnapshot {
  issuedAt: string
  expiresAt: string
}

export type TrialDecision =
  | { decision: 'issue' }
  | { decision: 'reactivate'; existing: TrialGrantSnapshot }
  | { decision: 'expired'; existing: TrialGrantSnapshot }
  | { decision: 'clock-tampered'; existing: TrialGrantSnapshot }

export interface ResolveTrialDecisionInput {
  now: Date
  existing: TrialGrantSnapshot | null
}

/**
 * Funcion pura: dado el estado actual de un dispositivo frente al trial,
 * decide que hacer. No toca red ni DB para poder testearse sin infraestructura.
 */
export function resolveTrialDecision(
  input: ResolveTrialDecisionInput,
): TrialDecision {
  const { now, existing } = input

  if (!existing) {
    return { decision: 'issue' }
  }

  const issuedAtMs = new Date(existing.issuedAt).getTime()
  if (issuedAtMs > now.getTime()) {
    return { decision: 'clock-tampered', existing }
  }

  const expiresAtMs = new Date(existing.expiresAt).getTime()
  if (expiresAtMs <= now.getTime()) {
    return { decision: 'expired', existing }
  }

  return { decision: 'reactivate', existing }
}

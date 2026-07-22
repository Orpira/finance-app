import type { AIInteractionEvent } from './AIInteractionEvent'
import type { AIInteractionState } from './AIInteractionState'

export interface AIInteractionTransition {
  readonly from: AIInteractionState
  readonly event: AIInteractionEvent
  readonly to: AIInteractionState
}

export const AI_INTERACTION_TRANSITIONS: readonly AIInteractionTransition[] = [
  { from: 'CREATED', event: 'VALIDATE', to: 'VALIDATED' },
  { from: 'VALIDATED', event: 'AUTHORIZE', to: 'AUTHORIZED' },
  { from: 'AUTHORIZED', event: 'BUILD_CONTEXT', to: 'CONTEXT_BUILT' },
  { from: 'CONTEXT_BUILT', event: 'EXECUTE', to: 'EXECUTING' },
  { from: 'EXECUTING', event: 'COMPLETE', to: 'COMPLETED' },
  { from: 'EXECUTING', event: 'FAIL', to: 'FAILED' },
  { from: 'EXECUTING', event: 'CANCEL', to: 'CANCELLED' },
] as const
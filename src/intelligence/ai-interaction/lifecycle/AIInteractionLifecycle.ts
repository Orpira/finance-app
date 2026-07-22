import { isFinalAIInteractionState } from './AIInteractionState'
import {
  AIInteractionLifecycleValidator,
  type AIInteractionLifecycleValidation,
} from './AIInteractionLifecycleValidator'
import type { AIInteractionTransition } from './AIInteractionTransition'

export class AIInteractionLifecycle {
  private readonly validator: AIInteractionLifecycleValidator

  constructor(transitions?: readonly AIInteractionTransition[]) {
    this.validator = new AIInteractionLifecycleValidator(transitions)
  }

  getNextState(currentState: string, event: string): string | null {
    const validation = this.validator.validate(currentState, event)
    return validation.allowed ? validation.nextState ?? null : null
  }

  validateTransition(currentState: string, event: string): AIInteractionLifecycleValidation {
    return this.validator.validate(currentState, event)
  }

  canApplyEvent(currentState: string, event: string): boolean {
    return this.validator.validate(currentState, event).allowed
  }

  applyEvent(currentState: string, event: string): string {
    const validation = this.validator.validate(currentState, event)
    if (!validation.allowed || !validation.nextState) {
      const errorCode = validation.code ?? 'TRANSITION_NOT_ALLOWED'
      throw new Error(`[${errorCode}] ${validation.safeMessage}`)
    }

    return validation.nextState
  }

  isFinalState(state: string): boolean {
    return isFinalAIInteractionState(state)
  }
}
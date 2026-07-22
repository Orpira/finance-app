import { isAIInteractionEvent } from './AIInteractionEvent'
import {
  isFinalAIInteractionState,
  isAIInteractionState,
} from './AIInteractionState'
import {
  AI_INTERACTION_TRANSITIONS,
  type AIInteractionTransition,
} from './AIInteractionTransition'

export const AI_INTERACTION_LIFECYCLE_FAILURE_CODES = [
  'INVALID_STATE',
  'INVALID_EVENT',
  'FINAL_STATE_IMMUTABLE',
  'TRANSITION_NOT_ALLOWED',
  'TRANSITION_NOT_REGISTERED',
] as const

export type AIInteractionLifecycleFailureCode =
  (typeof AI_INTERACTION_LIFECYCLE_FAILURE_CODES)[number]

export interface AIInteractionLifecycleValidation {
  readonly allowed: boolean
  readonly code?: AIInteractionLifecycleFailureCode
  readonly nextState?: string
  readonly safeMessage: string
}

type TransitionTable = Record<string, Record<string, string>>

export class AIInteractionLifecycleValidator {
  private readonly transitionTable: TransitionTable

  constructor(
    transitions: readonly AIInteractionTransition[] = AI_INTERACTION_TRANSITIONS,
  ) {
    this.transitionTable = this.buildTransitionTable(transitions)
  }

  validate(currentState: string, event: string): AIInteractionLifecycleValidation {
    if (!isAIInteractionState(currentState)) {
      return {
        allowed: false,
        code: 'INVALID_STATE',
        safeMessage: 'The current state is not part of the AI interaction lifecycle.',
      }
    }

    if (!isAIInteractionEvent(event)) {
      return {
        allowed: false,
        code: 'INVALID_EVENT',
        safeMessage: 'The event is not part of the AI interaction lifecycle.',
      }
    }

    if (isFinalAIInteractionState(currentState)) {
      return {
        allowed: false,
        code: 'FINAL_STATE_IMMUTABLE',
        safeMessage: 'Final AI interaction states are immutable.',
      }
    }

    const registeredTransitions = this.transitionTable[currentState]
    if (!registeredTransitions) {
      return {
        allowed: false,
        code: 'TRANSITION_NOT_REGISTERED',
        safeMessage: 'No transitions are registered for the current state.',
      }
    }

    const nextState = registeredTransitions[event]
    if (!nextState) {
      return {
        allowed: false,
        code: 'TRANSITION_NOT_ALLOWED',
        safeMessage: 'The event is not allowed for the current AI interaction state.',
      }
    }

    return {
      allowed: true,
      nextState,
      safeMessage: 'The lifecycle transition is allowed.',
    }
  }

  private buildTransitionTable(
    transitions: readonly AIInteractionTransition[],
  ): TransitionTable {
    const table: TransitionTable = {}

    for (const transition of transitions) {
      const stateTransitions = (table[transition.from] ??= {})

      if (stateTransitions[transition.event]) {
        throw new Error(
          `Duplicate lifecycle transition registered for ${transition.from}/${transition.event}.`,
        )
      }

      stateTransitions[transition.event] = transition.to
    }

    return table
  }
}
export const AI_INTERACTION_STATES = [
  'CREATED',
  'VALIDATED',
  'AUTHORIZED',
  'CONTEXT_BUILT',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export type AIInteractionState = (typeof AI_INTERACTION_STATES)[number]

export const AI_INTERACTION_FINAL_STATES = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export type AIInteractionFinalState = (typeof AI_INTERACTION_FINAL_STATES)[number]

const stateSet = new Set<string>(AI_INTERACTION_STATES)
const finalStateSet = new Set<string>(AI_INTERACTION_FINAL_STATES)

export function isAIInteractionState(value: string): value is AIInteractionState {
  return stateSet.has(value)
}

export function isFinalAIInteractionState(value: string): value is AIInteractionFinalState {
  return finalStateSet.has(value)
}
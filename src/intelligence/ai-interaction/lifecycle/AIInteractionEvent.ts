export const AI_INTERACTION_EVENTS = [
  'VALIDATE',
  'AUTHORIZE',
  'BUILD_CONTEXT',
  'EXECUTE',
  'COMPLETE',
  'FAIL',
  'CANCEL',
] as const

export type AIInteractionEvent = (typeof AI_INTERACTION_EVENTS)[number]

const eventSet = new Set<string>(AI_INTERACTION_EVENTS)

export function isAIInteractionEvent(value: string): value is AIInteractionEvent {
  return eventSet.has(value)
}
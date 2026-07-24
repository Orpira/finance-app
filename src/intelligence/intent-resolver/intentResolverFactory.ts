import type { IntentResolver } from './intentResolverContracts'
import {
  createDeterministicIntentResolver,
  type CreateDeterministicIntentResolverInput,
} from './deterministicIntentResolver'

export interface CreateIntentResolverInput extends CreateDeterministicIntentResolverInput {
  readonly strategy?: 'deterministic'
}

export function createIntentResolver(
  input: CreateIntentResolverInput = {},
): IntentResolver {
  const strategy = input.strategy ?? 'deterministic'

  if (strategy === 'deterministic') {
    return createDeterministicIntentResolver({
      now: input.now,
    })
  }

  return createDeterministicIntentResolver({
    now: input.now,
  })
}

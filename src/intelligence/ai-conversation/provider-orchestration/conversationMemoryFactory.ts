import {
  createConversationContextResolver as createConversationContextResolverInstance,
} from './conversationContextResolver'
import {
  createConversationMemory as createConversationMemoryInstanceFactory,
} from './conversationMemory'
import {
  createConversationMemoryStoreFacade,
} from './conversationMemoryStore'
import type {
  ConversationContextResolver,
  ConversationMemory,
  ConversationMemoryStore,
} from './conversationMemoryContracts'
import {
  validateConversationContextResolver,
  validateConversationMemoryStore,
} from './conversationMemoryValidator'
import {
  createInMemoryConversationStore,
} from './memory/inMemoryConversationStore'

export interface ConversationMemoryFactoryOptions {
  readonly expirationWindowMs?: number
  readonly store?: ConversationMemoryStore
}

export function createConversationMemoryFactoryStore(
  options: ConversationMemoryFactoryOptions = {},
): ConversationMemoryStore {
  const baseStore = options.store ?? createInMemoryConversationStore()
  const validation = validateConversationMemoryStore(baseStore)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return createConversationMemoryStoreFacade({
    store: baseStore,
    policy: {
      expirationWindowMs: options.expirationWindowMs ?? 30 * 60 * 1000,
    },
  })
}

export function createConversationMemoryInstance(
  options: ConversationMemoryFactoryOptions = {},
): ConversationMemory {
  return createConversationMemoryInstanceFactory({
    store: createConversationMemoryFactoryStore(options),
  })
}

export function createConversationMemory(): ConversationMemory {
  return createConversationMemoryInstance()
}

export function createConversationContextResolverFactory(): ConversationContextResolver {
  const resolver = createConversationContextResolverInstance()
  const validation = validateConversationContextResolver(resolver)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return resolver
}

export function createConversationContextResolver(): ConversationContextResolver {
  return createConversationContextResolverFactory()
}
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

function source(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8')
}

describe('AI conversation memory decoupling (PB-IS-011C)', () => {
  it('ConversationPage does not import Dexie, LocalConversationRepository or memory contracts', () => {
    const file = source('../src/pages/Conversation/ConversationPage.tsx')
    expect(file).not.toContain('dexie')
    expect(file).not.toContain('LocalConversationRepository')
    expect(file).not.toContain('aiConversationMemoryContracts')
  })

  it('application/infrastructure memory modules do not import React', () => {
    const applicationService = source('../src/application/ai-conversation/aiConversationApplicationService.ts')
    const memoryContracts = source('../src/application/ai-conversation/aiConversationMemoryContracts.ts')
    const repository = source('../src/database/localConversationRepository.ts')

    expect(applicationService).not.toContain("from 'react'")
    expect(memoryContracts).not.toContain("from 'react'")
    expect(repository).not.toContain("from 'react'")
  })

  it('pipeline, provider and inspector do not import memory contracts or repository', () => {
    const pipeline = source('../src/intelligence/execution-pipeline/aiExecutionPipeline.ts')
    const provider = source('../src/intelligence/provider/openAIProviderAdapter.ts')
    const inspector = source('../src/intelligence/execution-inspector/aiExecutionInspector.ts')

    expect(pipeline).not.toContain('aiConversationMemory')
    expect(pipeline).not.toContain('LocalConversationRepository')

    expect(provider).not.toContain('aiConversationMemory')
    expect(provider).not.toContain('LocalConversationRepository')

    expect(inspector).not.toContain('aiConversationMemory')
    expect(inspector).not.toContain('LocalConversationRepository')
  })
})

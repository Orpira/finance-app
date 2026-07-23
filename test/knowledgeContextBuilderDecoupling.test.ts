import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

function source(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8')
}

describe('Knowledge retrieval decoupling (PB-IS-011E)', () => {
  it('context builder does not import local knowledge repository directly', () => {
    const applicationService = source('../src/application/ai-conversation/aiConversationApplicationService.ts')
    const coreContextBuilder = source('../src/intelligence/context-builder/aiContextBuilder.ts')

    expect(applicationService).not.toContain('LocalKnowledgeRepository')
    expect(coreContextBuilder).not.toContain('LocalKnowledgeRepository')
    expect(coreContextBuilder).not.toContain('knowledgeDocuments')
  })

  it('provider and pipeline stay unaware of local knowledge storage implementation', () => {
    const provider = source('../src/intelligence/provider/openAIProviderAdapter.ts')
    const pipeline = source('../src/intelligence/execution-pipeline/aiExecutionPipeline.ts')

    expect(provider).not.toContain('localKnowledgeRepository')
    expect(provider).not.toContain('knowledgeDocuments')
    expect(pipeline).not.toContain('localKnowledgeRepository')
    expect(pipeline).not.toContain('knowledgeDocuments')
  })
})

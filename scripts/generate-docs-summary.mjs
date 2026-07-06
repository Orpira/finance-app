import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const includeN8n = process.argv.includes('--include-n8n')
const asJson = process.argv.includes('--json')

async function safeRead(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), 'utf8')
  } catch {
    return null
  }
}

async function safeList(relativePath) {
  try {
    const entries = await readdir(path.join(root, relativePath), { withFileTypes: true })
    return entries
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
  } catch {
    return []
  }
}

function pickDependencies(packageJson, names) {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}
  return names
    .map((name) => ({
      name,
      version: dependencies[name] || devDependencies[name] || null,
    }))
    .filter((item) => item.version)
}

async function loadWorkflowSummary() {
  const apiKey = process.env.N8N_API_KEY?.trim()
  const apiUrl = (process.env.N8N_API_URL || 'https://n8n.orpira.es/api/v1').replace(/\/$/, '')

  if (!apiKey) {
    return { status: 'pendiente de validar', reason: 'N8N_API_KEY no configurado en el entorno.' }
  }

  try {
    const response = await fetch(`${apiUrl}/workflows?limit=250`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      signal: AbortSignal.timeout(20000),
    })

    if (response.ok === false) {
      return {
        status: 'pendiente de validar',
        reason: `n8n respondió ${response.status}.`,
      }
    }

    const body = await response.json().catch(() => ({}))
    const workflows = Array.isArray(body.data)
      ? body.data.map((workflow) => ({
          id: workflow.id,
          name: workflow.name,
          active: workflow.active,
          updatedAt: workflow.updatedAt,
        }))
      : []

    return { status: 'ok', workflows }
  } catch (error) {
    return {
      status: 'pendiente de validar',
      reason: error instanceof Error ? error.message : 'No se pudo consultar n8n.',
    }
  }
}

function toMarkdown(summary) {
  const lines = []
  lines.push('# Private Balance Technical Summary')
  lines.push('')
  lines.push(`- GeneratedAt: ${summary.generatedAt}`)
  lines.push(`- Project: ${summary.package.name}`)
  lines.push(`- Version: ${summary.package.version}`)
  lines.push('')
  lines.push('## Technology Stack')
  for (const item of summary.stack) {
    lines.push(`- ${item.name}: ${item.version}`)
  }
  lines.push('')
  lines.push('## Main Folders')
  lines.push(`- Pages: ${summary.pages.join(', ') || 'pendiente de validar'}`)
  lines.push(`- Services: ${summary.services.join(', ') || 'pendiente de validar'}`)
  lines.push(`- API Endpoints: ${summary.api.join(', ') || 'pendiente de validar'}`)
  lines.push('')
  lines.push('## Documentation')
  lines.push(`- Canonical MCP Rules: ${summary.hasCanonicalMcpRules ? 'sí' : 'no'}`)
  lines.push(`- Generated Docs: ${summary.generatedDocs.join(', ') || 'pendiente de validar'}`)
  lines.push('')
  lines.push('## Workflows n8n')
  if (summary.workflows.status === 'ok') {
    for (const workflow of summary.workflows.workflows) {
      lines.push(`- ${workflow.name} (${workflow.id}) active=${workflow.active} updatedAt=${workflow.updatedAt}`)
    }
  } else {
    lines.push(`- ${summary.workflows.status}: ${summary.workflows.reason}`)
  }
  return lines.join('\n')
}

async function main() {
  const packageText = await safeRead('package.json')
  if (!packageText) {
    throw new Error('No se pudo leer package.json desde el directorio actual.')
  }

  const packageJson = JSON.parse(packageText)
  const pages = (await safeList('src/pages')).filter((entry) => entry.isDirectory).map((entry) => entry.name)
  const services = (await safeList('src/services')).filter((entry) => entry.name.endsWith('.ts')).map((entry) => entry.name)
  const api = (await safeList('api')).filter((entry) => entry.name.endsWith('.ts')).map((entry) => entry.name)
  const docs = (await safeList('docs')).filter((entry) => entry.name.endsWith('.md')).map((entry) => entry.name)
  const mcpRules = await safeRead('docs/MCP_RULES.md')

  const summary = {
    generatedAt: new Date().toISOString(),
    package: {
      name: packageJson.name,
      version: packageJson.version,
    },
    stack: pickDependencies(packageJson, [
      'react',
      'react-dom',
      'typescript',
      'vite',
      'tailwindcss',
      '@capacitor/core',
      '@neondatabase/serverless',
      'dexie',
      'react-router-dom',
      'zustand',
      'zod',
      'vitest',
    ]),
    pages,
    services,
    api,
    generatedDocs: docs,
    hasCanonicalMcpRules: Boolean(mcpRules),
    workflows: includeN8n
      ? await loadWorkflowSummary()
      : { status: 'pendiente de validar', reason: 'Ejecuta con --include-n8n para consultar workflows.' },
  }

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.log(toMarkdown(summary))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Error inesperado')
  process.exit(1)
})

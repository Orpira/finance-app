import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = join(process.cwd(), 'src')
const NATIVE_DIALOG_PATTERN =
  /\b(?:window|globalThis|self)\s*(?:\.\s*(?:confirm|alert|prompt)|\[\s*['"](?:confirm|alert|prompt)['"]\s*\])/g

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listSourceFiles(path) : [path]
  }))

  return nestedFiles.flat().filter((path) => ['.ts', '.tsx'].includes(extname(path)))
}

describe('native browser dialogs', () => {
  it('keeps application source free of native confirm, alert and prompt calls', async () => {
    const violations: string[] = []

    for (const path of await listSourceFiles(SOURCE_ROOT)) {
      const source = await readFile(path, 'utf8')
      if (NATIVE_DIALOG_PATTERN.test(source)) {
        violations.push(relative(process.cwd(), path))
      }
      NATIVE_DIALOG_PATTERN.lastIndex = 0
    }

    expect(violations).toEqual([])
  })
})

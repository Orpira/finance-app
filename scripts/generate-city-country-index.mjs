import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const supportedCountryCodes = new Set([
  'AR', 'AT', 'BE', 'BG', 'CO', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'MX',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
])

const sourcePath = process.argv[2]
const outputPath = resolve('src/data/cityCountryIndex.ts')

if (!sourcePath) {
  throw new Error(
    'Uso: node scripts/generate-city-country-index.mjs /ruta/cities5000.txt',
  )
}

function normalizeCityName(value) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en')
}

const source = await readFile(resolve(sourcePath), 'utf8')
const candidatesByCity = new Map()

for (const row of source.split('\n')) {
  if (!row) {
    continue
  }

  const columns = row.split('\t')
  const countryCode = columns[8]

  if (!supportedCountryCodes.has(countryCode)) {
    continue
  }

  const population = Number(columns[14]) || 0
  const names = new Set([columns[1], columns[2]])

  for (const name of names) {
    const normalizedName = normalizeCityName(name ?? '')

    if (!normalizedName) {
      continue
    }

    const candidates = candidatesByCity.get(normalizedName) ?? new Map()
    candidates.set(
      countryCode,
      Math.max(candidates.get(countryCode) ?? 0, population),
    )
    candidatesByCity.set(normalizedName, candidates)
  }
}

const entries = Array.from(candidatesByCity.entries())
  .sort(([firstName], [secondName]) => firstName.localeCompare(secondName, 'en'))
  .map(([name, candidates]) => {
    const countryCodes = Array.from(candidates.entries())
      .sort(([, firstPopulation], [, secondPopulation]) =>
        secondPopulation - firstPopulation,
      )
      .map(([countryCode]) => countryCode)

    return `  ${JSON.stringify(name)}: ${JSON.stringify(countryCodes)},`
  })

const output = [
  "import type { CountryCode } from '../types/settings'",
  '',
  'export const cityCountryIndex: Readonly<Record<string, readonly CountryCode[]>> = {',
  ...entries,
  '}',
  '',
].join('\n')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, output, 'utf8')

console.log(`Índice generado: ${entries.length} nombres en ${outputPath}`)
import { neon } from '@neondatabase/serverless'

let cachedClient: ReturnType<typeof neon> | undefined

export function getNeonClient() {
  if (cachedClient) return cachedClient

  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    process.env.NEON_DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL (o NEON_DATABASE_URL) no está configurado.')
  }

  cachedClient = neon(connectionString)
  return cachedClient
}

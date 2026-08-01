export const FORBIDDEN_CLIENT_SECRETS = [
  'VITE_N8N_WEBHOOK_URL',
  'VITE_N8N_WHATSAPP_WEBHOOK_URL',
  'VITE_PRIVATE_BALANCE_TOKEN',
  'VITE_EVOLUTION_API_KEY',
  'VITE_OPENAI_API_KEY',
] as const

/**
 * La lista de arriba cubre los nombres históricos (Evolution/n8n de
 * automatización financiera) y `VITE_OPENAI_API_KEY` (src/intelligence/
 * ai-provider/openAIConfiguration.ts lee esta variable para llamar a
 * OpenAI directamente desde el cliente si `VITE_AI_PROVIDER=openai`; ver
 * docs/architecture/18_AI_MEMORY_AND_PRIVACY_MODEL.md para el riesgo
 * completo). Además, se bloquea por patrón cualquier VITE_META_*,
 * VITE_N8N_* o VITE_OPENAI_*_KEY/SECRET/TOKEN, para que un nombre nuevo
 * (p. ej. META_ACCESS_TOKEN, N8N_COMMUNICATION_API_KEY,
 * VITE_OPENAI_ORG_SECRET) quede bloqueado sin depender de que alguien
 * recuerde añadirlo a mano a la lista literal.
 */
export const FORBIDDEN_CLIENT_SECRET_PATTERN = /^VITE_(META_|N8N_)|^VITE_OPENAI_.*_(KEY|SECRET|TOKEN)$/i

export function findExposedClientSecrets(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  return Object.keys(env).filter((key) => {
    if (!env[key]) return false
    return (
      (FORBIDDEN_CLIENT_SECRETS as readonly string[]).includes(key)
      || FORBIDDEN_CLIENT_SECRET_PATTERN.test(key)
    )
  })
}

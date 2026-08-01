import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const FORBIDDEN_CLIENT_SECRETS = [
  'VITE_N8N_WEBHOOK_URL',
  'VITE_N8N_WHATSAPP_WEBHOOK_URL',
  'VITE_PRIVATE_BALANCE_TOKEN',
  'VITE_EVOLUTION_API_KEY',
] as const

/**
 * La lista de arriba cubre los nombres históricos (Evolution/n8n de
 * automatización financiera). Además, se bloquea por patrón cualquier
 * VITE_META_* o VITE_N8N_* — el dominio completo de la integración
 * WhatsApp Cloud API y de automatización — para que un nombre nuevo
 * introducido ahí (p. ej. META_ACCESS_TOKEN, N8N_COMMUNICATION_API_KEY)
 * quede bloqueado sin depender de que alguien recuerde añadirlo a mano a
 * la lista literal. Ver server/communication/config/metaCloudConfig.ts
 * para el listado completo de variables META_ y N8N_ del backend.
 */
const FORBIDDEN_CLIENT_SECRET_PATTERN = /^VITE_(META_|N8N_)/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const exposedSecrets = Object.keys(env).filter((key) => {
    if (!env[key]) return false
    return (FORBIDDEN_CLIENT_SECRETS as readonly string[]).includes(key) || FORBIDDEN_CLIENT_SECRET_PATTERN.test(key)
  })

  if (exposedSecrets.length > 0) {
    throw new Error(
      `Variables privadas con prefijo VITE_ detectadas: ${exposedSecrets.join(', ')}. Usa exclusivamente variables de servidor.`,
    )
  }

  return {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /\/node_modules\/(react|react-dom|react-router-dom)\//,
              },
              {
                name: 'forms-vendor',
                test: /\/node_modules\/zod\//,
              },
              {
                name: 'calendar-vendor',
                test: /\/node_modules\/react-calendar\//,
              },
              {
                name: 'jspdf-vendor',
                test: /\/node_modules\/jspdf\//,
              },
              {
                name: 'canvas-vendor',
                test: /\/node_modules\/html2canvas\//,
              },
              {
                name: 'purify-vendor',
                test: /\/node_modules\/dompurify\//,
              },
              {
                name: 'capacitor-vendor',
                test: /\/node_modules\/@capacitor\//,
              },
              {
                name: 'app-vendor',
                test: /\/node_modules\/(dexie|lucide-react)\//,
              },
            ],
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
  }
})

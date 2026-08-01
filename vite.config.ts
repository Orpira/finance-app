import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { findExposedClientSecrets } from './src/config/forbiddenClientSecrets'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const exposedSecrets = findExposedClientSecrets(env)

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

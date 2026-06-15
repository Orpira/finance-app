import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
              test: /\/node_modules\/(@hookform|react-hook-form|zod)\//,
            },
            {
              name: 'calendar-vendor',
              test: /\/node_modules\/(date-fns|react-calendar)\//,
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
              test: /\/node_modules\/(dexie|zustand|lucide-react)\//,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss()
  ],
})

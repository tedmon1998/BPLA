import 'dotenv/config'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — серверный ESM-модуль без деклараций типов
import { createViteApiMiddleware } from './server/secureApi.mjs'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'flight-secure-api',
      configureServer(server) {
        server.middlewares.use(createViteApiMiddleware())
      },
    },
  ],
})

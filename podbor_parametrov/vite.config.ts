import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const { createGameApiMiddleware } = require('./server/gameApi.cjs')

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'secure-training-api',
      configureServer(server) {
        server.middlewares.use(createGameApiMiddleware())
      },
    },
  ],
})

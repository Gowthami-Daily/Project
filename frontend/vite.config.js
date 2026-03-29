import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Match FastAPI routes (same paths as on Render — no /fastapi prefix)
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/inflow': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ledger': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/outflow': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})

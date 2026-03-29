import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Proxy target for FastAPI. If Django uses 8000, run: uvicorn main:app --port 8001 and set VITE_DEV_PROXY_TARGET in .env
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'
  const proxy = { target: apiTarget, changeOrigin: true }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': proxy,
        '/inflow': proxy,
        '/ledger': proxy,
        '/outflow': proxy,
      },
    },
  }
})

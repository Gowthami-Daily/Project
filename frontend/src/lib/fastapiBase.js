/**
 * FastAPI base URL for production (Vercel).
 *
 * - **Vercel:** set `VITE_API_URL=https://your-service.onrender.com` (no trailing slash).
 * - **Local dev:** leave unset — requests stay same-origin and Vite proxies `/api/v1`, `/inflow`, etc.
 */
const raw = import.meta.env.VITE_API_URL
const origin = typeof raw === 'string' && raw.trim() ? raw.trim().replace(/\/$/, '') : ''

/**
 * Absolute or same-origin URL for a path on the FastAPI server (must start with `/`).
 */
export function fastapiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${p}` : p
}

export const FASTAPI_ORIGIN = origin

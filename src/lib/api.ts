/**
 * Modern API helper.
 *
 * In production (Vercel) — VITE_API_BASE_URL is empty.
 *   Calls go to `/api/...` on the same Vercel domain (HTTPS),
 *   and Vercel's vercel.json rewrites proxy them to Awardspace (HTTP).
 *   No mixed-content or CORS issues.
 *
 * In development (Vite) — VITE_API_BASE_URL is empty.
 *   Calls go to `/api/...` on the Vite dev server,
 *   and vite.config.ts proxies them to `http://localhost/supply_management/api/`.
 *
 * In custom setups — set VITE_API_BASE_URL to a full URL (e.g. http://localhost/api).
 */
const BASE_URL: string =
  (import.meta as Record<string, any>).env?.VITE_API_BASE_URL ?? ''

export function api(input: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${input}`, init)
}

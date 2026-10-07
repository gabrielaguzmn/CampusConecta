import createClient from 'openapi-fetch'
import { tokens } from '../auth/tokens'
import type { paths } from './schema'

const baseUrl = import.meta.env.VITE_API_URL || window.location.origin

function conToken(peticion: Request): Request {
  const access = tokens.access()
  if (access) peticion.headers.set('Authorization', `Bearer ${access}`)
  return peticion
}

let renovando: Promise<boolean> | null = null

// POST /api/auth/token/refresh/: recibe `refresh` y devuelve `access` (TokenRefresh).
function renovar(): Promise<boolean> {
  const refresh = tokens.refresh()
  if (!refresh) return Promise.resolve(false)
  renovando ??= fetch(`${baseUrl}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (r) => {
      if (!r.ok) return false
      const { access } = (await r.json()) as { access: string }
      tokens.guardar({ access })
      return true
    })
    .catch(() => false)
    .finally(() => {
      renovando = null
    })
  return renovando
}

// Ante un 401 se renueva el access una sola vez y se repite la petición; si falla, se cierra la sesión.
async function fetchConSesion(peticion: Request): Promise<Response> {
  const copia = peticion.clone()
  const respuesta = await fetch(conToken(peticion))
  if (respuesta.status !== 401 || !tokens.refresh() || peticion.url.includes('/api/auth/token/')) return respuesta
  if (!(await renovar())) {
    tokens.borrar()
    return respuesta
  }
  return fetch(conToken(copia))
}

export const api = createClient<paths>({ baseUrl, fetch: fetchConSesion })

type ErrorApi = { detail?: string; code?: string } & Record<string, unknown>

/** Mensaje general que envía la API (`detail`), en español (LANGUAGE_CODE es-co). */
export function mensajeDeError(error: unknown): string | undefined {
  const detalle = (error as ErrorApi | undefined)?.detail
  return typeof detalle === 'string' ? detalle : undefined
}

/** Errores por campo que envía la API ({ campo: ["mensaje"] }). */
export function erroresDeCampo(error: unknown): Record<string, string> {
  const resultado: Record<string, string> = {}
  for (const [campo, valor] of Object.entries((error as ErrorApi | undefined) ?? {})) {
    if (Array.isArray(valor) && typeof valor[0] === 'string') resultado[campo] = valor[0]
  }
  return resultado
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { components } from './schema'

export type Caso = components['schemas']['Caso']
export type EstadoCaso = NonNullable<Caso['estado']>
export type Norma = components['schemas']['NormaEnum']

async function datos<T>(peticion: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await peticion
  if (error || data === undefined) throw error
  return data
}

// ADMIN-2 · criterio 1: reportes agrupados por evento.
export function useCasos(estado?: EstadoCaso) {
  return useQuery({
    queryKey: ['admin', 'casos', estado],
    queryFn: () => datos(api.GET('/api/admin/casos/', { params: { query: estado ? { estado } : {} } })),
  })
}

// ADMIN-1: todos los eventos, incluidos los ocultos.
export function useEventosAdmin(oculto?: boolean) {
  return useQuery({
    queryKey: ['admin', 'eventos', oculto],
    queryFn: () => datos(api.GET('/api/admin/eventos/', { params: { query: oculto === undefined ? {} : { oculto } } })),
  })
}

export function useUsuariosAdmin() {
  return useQuery({ queryKey: ['admin', 'usuarios'], queryFn: () => datos(api.GET('/api/admin/usuarios/')) })
}

export function useCategoriasAdmin() {
  return useQuery({ queryKey: ['admin', 'categorias'], queryFn: () => datos(api.GET('/api/admin/categorias/')) })
}

export function useRegistro() {
  return useQuery({ queryKey: ['admin', 'registro'], queryFn: () => datos(api.GET('/api/admin/registro/')) })
}

/** Tras moderar, todo lo que ve la comunidad puede cambiar (RNF-005). */
export function useRefrescar() {
  const cliente = useQueryClient()
  return () => Promise.all(['admin', 'eventos', 'mapa', 'evento', 'mis-eventos', 'categorias'].map((clave) => cliente.invalidateQueries({ queryKey: [clave] })))
}

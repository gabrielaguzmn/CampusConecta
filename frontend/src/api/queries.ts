import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { paths } from './schema'

export type FiltrosFeed = NonNullable<paths['/api/eventos/']['get']['parameters']['query']>

// CATEGORY-1 · criterio 1: GET /api/categorias/ devuelve las categorías activas.
export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await api.GET('/api/categorias/')).data ?? [],
  })
}

// DISPLAY-1, DISPLAY-2: GET /api/eventos/ devuelve solo eventos vigentes (RF-005), del más reciente al más antiguo (G-37).
export function useEventos(filtros: FiltrosFeed) {
  return useQuery({
    queryKey: ['eventos', filtros],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/eventos/', { params: { query: filtros } })
      if (error || !data) throw error
      return data
    },
  })
}

// INTERACTIVITY-1: GET /api/mapa/ devuelve los eventos vigentes agrupados por ubicación del catálogo.
export function useMapa() {
  return useQuery({
    queryKey: ['mapa'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/mapa/')
      if (error || !data) throw error
      return data
    },
  })
}

// INTERACTIVITY-2 · criterio 2: detalle completo. 404 si el evento ya no es vigente o está oculto (G-38).
export function useEvento(id: number) {
  return useQuery({
    queryKey: ['evento', id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/api/eventos/{id}/', { params: { path: { id } } })
      if (response.status === 404) return null
      if (error || !data) throw error
      return data
    },
  })
}

// DISPLAY-3: causas del reporte = normas de uso (G-20).
export function useNormas() {
  return useQuery({
    queryKey: ['normas'],
    queryFn: async () => (await api.GET('/api/normas/')).data ?? [],
    staleTime: Infinity,
  })
}

// PUBLICATION-2: GET /api/mis-eventos/?vista=vigentes|historial
export function useMisEventos(vista: 'vigentes' | 'historial') {
  return useQuery({
    queryKey: ['mis-eventos', vista],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/mis-eventos/', { params: { query: { vista } } })
      if (error || !data) throw error
      return data
    },
  })
}

// RF-009: catálogo fijo de ubicaciones.
export function useUbicaciones() {
  return useQuery({
    queryKey: ['ubicaciones'],
    queryFn: async () => (await api.GET('/api/ubicaciones/')).data ?? [],
    staleTime: Infinity,
  })
}

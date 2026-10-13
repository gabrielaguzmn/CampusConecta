import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { components } from '../api/schema'
import { tokens } from './tokens'

type Usuario = components['schemas']['UsuarioActual']
type Sesion = {
  usuario: Usuario | null
  cargando: boolean
  /** Lanza el cuerpo de error de la API si las credenciales no sirven. */
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => void
}

const SesionContexto = createContext<Sesion | null>(null)

async function obtenerUsuario(): Promise<Usuario | null> {
  if (!tokens.access() && !tokens.refresh()) return null
  const { data } = await api.GET('/api/auth/yo/')
  return data ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cliente = useQueryClient()
  const { data: usuario = null, isPending } = useQuery({
    queryKey: ['yo'],
    queryFn: obtenerUsuario,
    retry: false,
    // Sin tokens no hay sesión que consultar: se resuelve sin esperar a la red.
    initialData: () => (tokens.access() || tokens.refresh() ? undefined : null),
  })

  useEffect(() => tokens.alCerrarse(() => cliente.setQueryData(['yo'], null)), [cliente])

  async function iniciarSesion(email: string, password: string) {
    const { data, error } = await api.POST('/api/auth/token/', { body: { email, password } })
    if (!data) throw error
    tokens.guardar(data)
    await cliente.fetchQuery({ queryKey: ['yo'], queryFn: obtenerUsuario })
  }

  function cerrarSesion() {
    tokens.borrar()
    cliente.clear()
  }

  return (
    <SesionContexto.Provider value={{ usuario, cargando: isPending, iniciarSesion, cerrarSesion }}>
      {children}
    </SesionContexto.Provider>
  )
}

export function useSesion(): Sesion {
  const sesion = useContext(SesionContexto)
  if (!sesion) throw new Error('useSesion debe usarse dentro de <AuthProvider>')
  return sesion
}

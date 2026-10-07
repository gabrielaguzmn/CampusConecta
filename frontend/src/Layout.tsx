import { Outlet } from 'react-router'
import { useSesion } from './auth/AuthProvider'
import { BarraNavegacion } from './components/BarraNavegacion'

// Figma muestra "LM": iniciales del nombre del usuario (GET /api/auth/yo/).
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? '')
    .join('')
}

export function Layout() {
  const { usuario } = useSesion()
  return (
    <>
      <BarraNavegacion iniciales={usuario ? iniciales(usuario.nombre) : ''} />
      <Outlet />
    </>
  )
}

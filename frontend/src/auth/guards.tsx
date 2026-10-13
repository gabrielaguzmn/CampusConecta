import { Navigate, Outlet, useLocation } from 'react-router'
import { useSesion } from './AuthProvider'

// ACCESS-1 · DoD: "Acceso a mapa y feed restringido a sesión iniciada."
export function RequiereSesion() {
  const { usuario, cargando } = useSesion()
  const ubicacion = useLocation()
  // TODO(PENDIENTE G-51: estado de carga sin diseño)
  if (cargando) return null
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />
  return <Outlet />
}

export function SoloSinSesion() {
  const { usuario, cargando } = useSesion()
  if (cargando) return null
  if (usuario) return <Navigate to="/feed" replace />
  return <Outlet />
}

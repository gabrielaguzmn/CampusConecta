import { Outlet, useNavigate } from 'react-router'
import { useSesion } from './auth/AuthProvider'
import { BarraNavegacion } from './components/BarraNavegacion'
import { VoiceAssistant } from './voice-assistant/components/VoiceAssistant'

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
  const { usuario, cerrarSesion } = useSesion()
  const navegar = useNavigate()
  return (
    <>
      <BarraNavegacion
        iniciales={usuario ? iniciales(usuario.nombre) : ''}
        esAdministrador={usuario?.es_administrador}
        cuenta={
          usuario
            ? {
            nombre: usuario.nombre,
            email: usuario.email,
            onCerrarSesion: () => {
              cerrarSesion()
              navegar('/login', { replace: true })
            },
              }
            : undefined
        }
      />
      <Outlet />
<VoiceAssistant />
    </>
  )
}

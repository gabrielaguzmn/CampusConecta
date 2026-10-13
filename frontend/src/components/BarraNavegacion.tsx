import { CalendarDays, LayoutGrid, Map, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router'
import { Buscador } from './Buscador'
import { MenuCuenta } from './MenuCuenta'

// Figma 4:30135 · Navegación (5:25 Desktop, 5:26 Mobile):
// "Barra principal blanca de 72 px; navegación con texto e iconos. Adaptación mobile sin isotipo."
const ENLACES = [
  { etiqueta: 'Feed', a: '/feed', Icono: LayoutGrid },
  { etiqueta: 'Mis Eventos', a: '/mis-eventos', Icono: CalendarDays },
  { etiqueta: 'Mapa', a: '/mapa', Icono: Map },
]
// RF-024: el enlace al módulo de administración solo aparece para administradores (sin diseño en Figma, G-12).
const ADMIN = { etiqueta: 'Administración', a: '/admin', Icono: ShieldCheck }

const margen = 'px-4 md:px-8 xl:px-20'

type Cuenta = { nombre: string; email: string; onCerrarSesion: () => void }

export function BarraNavegacion({ iniciales, esAdministrador = false, cuenta }: { iniciales: string; esAdministrador?: boolean; cuenta?: Cuenta }) {
  const enlaces = esAdministrador ? [...ENLACES, ADMIN] : ENLACES
  return (
    <header className="bg-superficie">
      <div className={`flex h-18 items-center justify-between ${margen}`}>
        <span className="text-xl font-bold tracking-[-0.7px] text-primario md:text-2xl">CampusConecta</span>
        {/* Buscador en la barra desde Tablet (Figma 4:28896, 4:30004); en Mobile va dentro del Feed. */}
        <Buscador className="hidden h-11 w-[360px] bg-fondo md:flex" />
        {/* Sin campana de notificaciones (decisión 2026-10-07). */}
        {cuenta ? (
          <MenuCuenta iniciales={iniciales} {...cuenta} />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-primario">{iniciales}</span>
        )}
      </div>
      <nav className={`flex h-13 justify-between border-y border-borde md:h-12 md:justify-start md:gap-8 ${margen}`}>
        {enlaces.map(({ etiqueta, a, Icono }) => (
          <NavLink
            key={a}
            to={a}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-3 text-sm ${isActive ? 'border-accion font-semibold text-primario' : 'border-transparent text-texto-secundario'}`
            }
          >
            <Icono size={18} aria-hidden />
            {a === '/admin' ? (
              <>
                <span className="md:hidden">Admin</span>
                <span className="hidden md:inline">{etiqueta}</span>
              </>
            ) : (
              etiqueta
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

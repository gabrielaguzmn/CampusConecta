import { CalendarDays, LayoutGrid, Map } from 'lucide-react'
import { NavLink } from 'react-router'

// Figma 4:30135 · Navegación (5:25 Desktop, 5:26 Mobile):
// "Barra principal blanca de 72 px; navegación con texto e iconos. Adaptación mobile sin isotipo."
const ENLACES = [
  { etiqueta: 'Feed', a: '/feed', Icono: LayoutGrid },
  { etiqueta: 'Mis Eventos', a: '/mis-eventos', Icono: CalendarDays },
  { etiqueta: 'Mapa', a: '/mapa', Icono: Map },
]

const margen = 'px-4 md:px-8 xl:px-20'

export function BarraNavegacion({ iniciales }: { iniciales: string }) {
  return (
    <header className="bg-superficie">
      <div className={`flex h-18 items-center justify-between ${margen}`}>
        <span className="text-xl font-bold tracking-[-0.7px] text-primario md:text-2xl">CampusConecta</span>
        {/* TODO(PENDIENTE G-40: buscador "Buscar eventos..." y campana fuera del Release 1) */}
        {/* TODO(PENDIENTE G-13: menú del avatar y cierre de sesión sin diseño) */}
        <span className="flex size-9 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-primario">
          {iniciales}
        </span>
      </div>
      <nav className={`flex h-13 justify-between border-y border-borde md:h-12 md:justify-start md:gap-8 ${margen}`}>
        {ENLACES.map(({ etiqueta, a, Icono }) => (
          <NavLink
            key={a}
            to={a}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-3 text-sm ${isActive ? 'border-accion font-semibold text-primario' : 'border-transparent text-texto-secundario'}`
            }
          >
            <Icono size={18} aria-hidden />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

import { NavLink } from 'react-router'

// Figma 4:30135 · Tabs (5:19–5:20): "Activo #950000 con subrayado #E20000."
export function Tabs({ pestanas }: { pestanas: { etiqueta: string; a: string }[] }) {
  return (
    <nav className="flex h-13 gap-6 border-b border-borde">
      {pestanas.map(({ etiqueta, a }) => (
        <NavLink
          key={a}
          to={a}
          end
          className={({ isActive }) =>
            `flex items-center border-b-3 text-sm ${isActive ? 'border-accion font-semibold text-primario' : 'border-transparent text-metadatos'}`
          }
        >
          {etiqueta}
        </NavLink>
      ))}
    </nav>
  )
}

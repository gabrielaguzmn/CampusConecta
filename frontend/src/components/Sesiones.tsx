import type { components } from '../api/schema'
import { formatoDia } from '../lib/formato'

type Fecha = components['schemas']['Fecha']

// Figma 4:30135 · Sesiones / Multifecha (5:16): "✓ 10 Oct. — Finalizada", "● 17 Oct. — En vivo", "○ 24 Oct. — Próxima".
// La interfaz dice "Sesiones" y la API "fechas" (G-18).
const ANOTACIONES = {
  finalizada: { simbolo: '✓', etiqueta: 'Finalizada', clases: 'text-metadatos' },
  en_vivo: { simbolo: '●', etiqueta: 'En vivo', clases: 'text-accion' },
  proxima: { simbolo: '○', etiqueta: 'Próxima', clases: 'text-primario' },
} as const

export function Sesiones({ fechas, className = 'gap-1' }: { fechas: Fecha[]; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <p className="text-[13px] font-semibold text-texto">Sesiones</p>
      <ul className={`flex flex-col ${className}`}>
        {fechas.map((fecha) => {
          // TODO(PENDIENTE G-45: anotación de una fecha cancelada sin diseño)
          if (fecha.estado === 'cancelada') return null
          const { simbolo, etiqueta, clases } = ANOTACIONES[fecha.estado]
          return (
            <li key={fecha.id} className={`text-[13px] ${clases}`}>
              <span aria-hidden>{simbolo}</span> {formatoDia(fecha.inicio)} — {etiqueta}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

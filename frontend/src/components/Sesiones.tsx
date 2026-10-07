import type { components } from '../api/schema'
import { formatoDiaYHorario } from '../lib/formato'

type Fecha = components['schemas']['FechaPublica']

// Figma 4:30135 · Sesiones / Multifecha (5:16): "✓ 10 Oct. — Finalizada", "● 17 Oct. — En vivo", "○ 24 Oct. — Próxima".
// Decisión 2026-10-07 (G-45): cada sesión muestra su horario junto al día, y la cancelada lleva "×" y va tachada.
// La interfaz dice "Sesiones" y la API "fechas" (G-18).
const ANOTACIONES = {
  finalizada: { simbolo: '✓', etiqueta: 'Finalizada', clases: 'text-metadatos' },
  en_vivo: { simbolo: '●', etiqueta: 'En vivo', clases: 'text-accion' },
  proxima: { simbolo: '○', etiqueta: 'Próxima', clases: 'text-primario' },
  cancelada: { simbolo: '×', etiqueta: 'Cancelada', clases: 'text-destructivo' },
} as const

export function Sesiones({ fechas, className = 'gap-1' }: { fechas: Fecha[]; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <p className="text-[13px] font-semibold text-texto">Sesiones</p>
      <ul className={`flex flex-col ${className}`}>
        {fechas.map((fecha) => {
          const { simbolo, etiqueta, clases } = ANOTACIONES[fecha.estado]
          const cuando = formatoDiaYHorario(fecha.inicio, fecha.fin)
          return (
            <li key={fecha.id} className={`text-[13px] ${clases}`}>
              <span aria-hidden>{simbolo}</span>{' '}
              {fecha.estado === 'cancelada' ? <s>{cuando}</s> : cuando} — {etiqueta}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

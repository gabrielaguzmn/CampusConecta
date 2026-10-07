import type { components } from '../api/schema'

type Estado = Exclude<components['schemas']['FechaPublica']['estado'], 'finalizada'>

// Figma 4:30135: "Solo tres estados oficiales. Finalizada se usa únicamente como anotación de una fecha pasada."
// El símbolo y la etiqueta acompañan siempre al color (regla 7). El estado llega de la API (RF-019); aquí no se calcula.
const BADGES: Record<Estado, { simbolo: string; etiqueta: string; clases: string }> = {
  en_vivo: { simbolo: '●', etiqueta: 'En vivo', clases: 'bg-badge text-accion' },
  proxima: { simbolo: '○', etiqueta: 'Próximo', clases: 'bg-badge text-primario' },
  cancelada: { simbolo: '×', etiqueta: 'Cancelado', clases: 'bg-badge-cancelado text-destructivo' },
}

export function EstadoBadge({ estado }: { estado: Estado }) {
  const { simbolo, etiqueta, clases } = BADGES[estado]
  return (
    <span className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pildora px-2.5 ${clases}`}>
      <span aria-hidden className="text-xs font-bold">
        {simbolo}
      </span>
      <span className="text-[13px] font-semibold">{etiqueta}</span>
    </span>
  )
}

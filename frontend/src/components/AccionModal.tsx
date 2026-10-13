import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Figma 4:30135 · Modal de gestión: "Acciones de 52 px" con ícono de 20 px y etiqueta Semi Bold 16.
// Colores de las etiquetas: Editar #0D0D0D, Cancelar #E20000, Eliminar #490000; "Crear evento" (34:161) va sobre #E20000.
const VARIANTES = {
  neutra: 'border border-borde bg-superficie text-texto hover:bg-fondo',
  accion: 'border border-borde bg-superficie text-accion hover:bg-fondo',
  destructiva: 'border border-borde bg-superficie text-destructivo hover:bg-fondo',
  principal: 'bg-accion text-white hover:bg-primario disabled:bg-borde disabled:text-texto-secundario',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { icono?: ReactNode; variante?: keyof typeof VARIANTES }

export function AccionModal({ icono, variante = 'neutra', className = 'h-13 gap-4', type = 'button', children, ...props }: Props) {
  return (
    <button
      type={type}
      className={`flex w-full items-center rounded-control px-4 text-left text-base font-semibold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primario disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {/* Figma: el ícono de las acciones neutras es gris (#8C8C8C, «pencil» 4:30625) */}
      {icono && <span aria-hidden className={`shrink-0 ${variante === 'neutra' ? 'text-metadatos' : ''}`}>{icono}</span>}
      {children}
    </button>
  )
}

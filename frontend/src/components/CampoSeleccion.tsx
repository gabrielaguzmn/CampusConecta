import { useId, type Ref, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

// Mismo estilo que el Input de Figma 4:30135 (5:7–5:10); el select aparece en Crear evento (34:17 «Categoría»).
type Props = SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; error?: string; ref?: Ref<HTMLSelectElement> }

export function CampoSeleccion({ etiqueta, error, className = '', children, ...props }: Props) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-texto">
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 w-full appearance-none rounded-control border bg-superficie pr-10 pl-4 text-sm text-texto focus:border-accion focus:ring-1 focus:ring-accion focus:outline-none focus:ring-inset invalid:text-metadatos ${error ? 'border-accion' : 'border-borde'}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-metadatos" />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-primario">
          {error}
        </p>
      )}
    </div>
  )
}

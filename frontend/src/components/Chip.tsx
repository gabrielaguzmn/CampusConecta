import type { ButtonHTMLAttributes } from 'react'

// Figma 4:30135 · Chip / Activo y Chip / Inactivo (5:11–5:12)
export function Chip({ activo, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { activo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={`h-11 shrink-0 rounded-pildora px-4 text-sm whitespace-nowrap ${activo ? 'bg-accion font-semibold text-white' : 'bg-fondo text-texto'} ${className}`}
      {...props}
    />
  )
}

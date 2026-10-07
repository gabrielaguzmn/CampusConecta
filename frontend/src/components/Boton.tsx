import type { ButtonHTMLAttributes } from 'react'

// Figma 4:30135 · Botones (5:2–5:6): "Altura 48 px · Radio 10 px · Foco visible · Etiqueta Inter 14 / 600."
export function Boton({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`h-12 rounded-control bg-accion px-4 text-sm font-semibold text-white transition-colors hover:bg-primario focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primario active:bg-oscuro disabled:cursor-not-allowed disabled:bg-borde disabled:text-texto-secundario ${className}`}
      {...props}
    />
  )
}

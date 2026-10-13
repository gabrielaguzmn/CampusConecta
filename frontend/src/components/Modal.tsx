import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Figma 4:30135 · Modal de gestión (5:23–5:24): "Overlay negro translúcido · Cierre visible"
export function Modal({
  titulo,
  onCerrar,
  children,
  className = 'p-8',
  ancho = 'max-w-[500px]',
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
  className?: string
  ancho?: string
}) {
  const idTitulo = useId()
  const dialogo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    dialogo.current?.focus()
    return () => anterior?.focus()
  }, [])

  function alPulsarTecla(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar()
    }
    if (e.key !== 'Tab' || !dialogo.current) return
    const enfocables = dialogo.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo?.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-texto/50 px-4 py-3 md:py-9">
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alPulsarTecla}
        className={`mx-auto my-auto flex w-full ${ancho} flex-col gap-6 rounded-tarjeta bg-superficie shadow-elevada outline-none ${className}`}
      >
        <div className="flex items-center justify-between">
          <h2 id={idTitulo} className="text-2xl font-bold text-texto">
            {titulo}
          </h2>
          {/* La capa de Figma se llama "Cerrar" (4:30408) */}
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="flex size-11 items-center justify-center text-texto-secundario">
            <X size={24} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

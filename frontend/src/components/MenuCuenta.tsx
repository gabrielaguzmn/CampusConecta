import { useEffect, useId, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'

// Menú del avatar (G-13): sin diseño en Figma; creado el 2026-10-07 con el avatar de Figma 4:30135 (36 px, #FFF4F4,
// iniciales #950000) y el estilo de tarjeta elevada. Su única acción es cerrar sesión.
export function MenuCuenta({ iniciales, nombre, email, onCerrarSesion }: { iniciales: string; nombre: string; email: string; onCerrarSesion: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const idMenu = useId()

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={`Cuenta de ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        className="flex size-9 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-primario focus-visible:outline-3 focus-visible:outline-primario"
      >
        {iniciales}
      </button>
      {abierto && (
        <div id={idMenu} role="menu" aria-label="Cuenta" className="absolute top-12 right-0 z-[900] flex w-64 flex-col gap-2 rounded-tarjeta bg-superficie p-2 shadow-elevada">
          <div className="flex flex-col gap-1 px-3 pt-2 pb-1">
            <p className="text-sm font-semibold text-texto">{nombre}</p>
            <p className="truncate text-[13px] text-texto-secundario">{email}</p>
          </div>
          <hr className="border-borde" />
          <button
            type="button"
            role="menuitem"
            onClick={onCerrarSesion}
            className="flex h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-semibold text-destructivo hover:bg-fondo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primario"
          >
            <LogOut size={18} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

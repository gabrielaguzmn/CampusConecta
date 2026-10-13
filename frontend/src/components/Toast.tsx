import { useEffect } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type TipoToast = 'exito' | 'error'

export function Toast({ tipo, mensaje, cerrar }: { tipo: TipoToast; mensaje: string; cerrar: () => void }) {
  const exito = tipo === 'exito'

  useEffect(() => {
    const temporizador = window.setTimeout(cerrar, 7000)
    return () => window.clearTimeout(temporizador)
  }, [cerrar])

  return (
    <div
      role={exito ? 'status' : 'alert'}
      className={`fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-control border bg-superficie p-4 shadow-elevada ${
        exito ? 'border-green-200' : 'border-red-200'
      }`}
    >
      {exito ? <CheckCircle2 className="mt-0.5 shrink-0 text-green-700" size={20} aria-hidden /> : <CircleAlert className="mt-0.5 shrink-0 text-primario" size={20} aria-hidden />}
      <p className="flex-1 text-sm">{mensaje}</p>
      <button type="button" aria-label="Cerrar notificación" onClick={cerrar} className="text-texto-secundario hover:text-texto">
        <X size={18} aria-hidden />
      </button>
    </div>
  )
}
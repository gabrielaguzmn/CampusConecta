import { useId, useState, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Figma 4:30135 · Inputs (5:7–5:10): "Etiqueta persistente · Focus #E20000 · Error expresado también mediante texto."
type Comunes = { etiqueta: string; error?: string }
type PropsInput = Comunes & InputHTMLAttributes<HTMLInputElement> & { multilinea?: false; ref?: Ref<HTMLInputElement> }
type PropsArea = Comunes & TextareaHTMLAttributes<HTMLTextAreaElement> & { multilinea: true; ref?: Ref<HTMLTextAreaElement> }

const caja =
  'w-full rounded-control border bg-superficie px-4 text-sm text-texto placeholder:text-metadatos focus:outline-none focus:border-accion focus:ring-1 focus:ring-inset focus:ring-accion'

export function CampoTexto(props: PropsInput | PropsArea) {
  const id = useId()
  const idError = `${id}-error`
  const [visible, setVisible] = useState(false)
  const { etiqueta, error, className = '' } = props
  const borde = error ? 'border-accion' : 'border-borde'
  const accesibles = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? idError : undefined }

  let control
  if (props.multilinea) {
    const { etiqueta: _e, error: _r, multilinea: _m, className: _c, ...resto } = props
    control = <textarea {...resto} {...accesibles} className={`${caja} ${borde} h-[72px] resize-none py-3`} />
  } else {
    const { etiqueta: _e, error: _r, multilinea: _m, className: _c, type, ...resto } = props
    const esContrasena = type === 'password'
    control = (
      <div className="relative">
        <input
          {...resto}
          {...accesibles}
          type={esContrasena && visible ? 'text' : type}
          className={`${caja} ${borde} h-12 ${esContrasena ? 'pr-12' : ''}`}
        />
        {/* G-53 (decisión 2026-10-07): mostrar u ocultar la contraseña. Figma 4:28777 muestra "eye-off". */}
        {esContrasena && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-metadatos"
          >
            {visible ? <Eye size={20} aria-hidden /> : <EyeOff size={20} aria-hidden />}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-texto">
        {etiqueta}
      </label>
      {control}
      {error && (
        <p id={idError} className="text-[13px] text-primario">
          {error}
        </p>
      )}
    </div>
  )
}

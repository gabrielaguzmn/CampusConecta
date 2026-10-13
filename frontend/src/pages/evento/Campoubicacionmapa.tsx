import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { SelectorUbicacionMapa, type UbicacionCatalogo } from './Selectorubicacionmapa'

type Props = {
  ubicaciones: UbicacionCatalogo[]
  value?: number
  onChange: (ubicacionId: number) => void
  colorCategoria?: string
  error?: string
}

// Campo "Ubicación" del formulario: select del catálogo (accesible) + botón para elegir en el mapa.
// Ambos escriben el mismo valor, así que el pin y el select siempre coinciden.
export function CampoUbicacionMapa({ ubicaciones, value, onChange, colorCategoria, error }: Props) {
  const [abierto, setAbierto] = useState(false)
  // reduce en vez de Object.groupBy para no depender de la librería ES2024 del tsconfig
  const porZona = ubicaciones.reduce<Record<string, UbicacionCatalogo[]>>((grupos, u) => {
    const clave = u.zona ? `Zona ${u.zona}` : 'Otras'
    ;(grupos[clave] ??= []).push(u)
    return grupos
  }, {})
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="ubicacion" className="text-[13px] font-semibold">Ubicación *</label>
      <div className="flex gap-2">
        <select id="ubicacion" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} aria-invalid={!!error}
          className="h-11 min-w-0 flex-1 rounded-control border border-borde bg-superficie px-3 text-sm">
          <option value="" disabled>Selecciona una ubicación</option>
          {Object.entries(porZona).map(([grupo, items]) => (
            <optgroup key={grupo} label={grupo}>
              {items.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={() => setAbierto(true)}
          className="flex h-11 items-center gap-2 rounded-control border border-borde px-3 text-sm font-semibold text-primario">
          <MapPin size={16} aria-hidden /> Ver en el mapa
        </button>
      </div>
      {error && <p role="alert" className="text-[13px] text-primario">{error}</p>}
      {abierto && <SelectorUbicacionMapa ubicaciones={ubicaciones} value={value} onChange={onChange} color={colorCategoria} onCerrar={() => setAbierto(false)} />}
    </div>
  )
}
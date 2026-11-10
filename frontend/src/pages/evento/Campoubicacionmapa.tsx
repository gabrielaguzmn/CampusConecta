import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { CampoSeleccion } from '../../components/CampoSeleccion'
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
      <div className="flex items-start gap-2">
        <CampoSeleccion
          etiqueta="Ubicación *"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          error={error}
          className="min-w-0 flex-1"
        >
          <option value="" disabled>Selecciona una ubicación</option>
          {Object.entries(porZona).map(([grupo, items]) => (
            <optgroup key={grupo} label={grupo}>
              {items.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </optgroup>
          ))}
        </CampoSeleccion>
        <button type="button" onClick={() => setAbierto(true)}
          className="mt-7 flex h-11 shrink-0 items-center gap-2 rounded-control border border-borde px-3 text-sm font-semibold text-primario">
          <MapPin size={16} aria-hidden /> Ver en el mapa
        </button>
      </div>
      {abierto && <SelectorUbicacionMapa ubicaciones={ubicaciones} value={value} onChange={onChange} color={colorCategoria} onCerrar={() => setAbierto(false)} />}
    </div>
  )
}
import { useMemo, useState, type MouseEvent } from 'react'
import { MapPin, RotateCcw } from 'lucide-react'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { PinMapa } from '../../components/PinMapa'
import { alto, ancho, limitesZona, lugares, zonas, type Zona } from '../../lib/Campusdata'
import { useMascarasCampus } from '../../lib/Usemascarascampus'
import "../mapa/mapa.css";

// Ubicación del catálogo (RF-009). `codigo` enlaza con el plano: "<zona>:<edificio>", p. ej. "E:E1".
export type UbicacionCatalogo = { id: number; nombre: string; codigo?: string | null; tipo?: string; zona?: string }

type Props = {
  ubicaciones: UbicacionCatalogo[]
  value?: number
  onChange: (ubicacionId: number) => void
  /** Color de la categoría elegida en el formulario (Categoria.color de la API). */
  color?: string
  onCerrar: () => void
}

export function SelectorUbicacionMapa({ ubicaciones, value, onChange, color = '#950000', onCerrar }: Props) {
  const { datos, error } = useMascarasCampus()
  const porCodigo = useMemo(() => new Map(ubicaciones.filter((u) => u.codigo).map((u) => [u.codigo!, u])), [ubicaciones])
  const seleccionada = ubicaciones.find((u) => u.id === value)
  const [zona, setZona] = useState<Zona | null>(() => (zonas as readonly string[]).includes(seleccionada?.zona ?? '') ? (seleccionada!.zona as Zona) : null)
  const [hoverZona, setHoverZona] = useState<Zona | null>(null)
  const [hoverLugar, setHoverLugar] = useState<string | null>(null)

  function indice(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * ancho)
    const y = Math.floor(((e.clientY - r.top) / r.height) * alto)
    return x < 0 || x >= ancho || y < 0 || y >= alto ? null : y * ancho + x
  }
  const zonaEn = (e: MouseEvent<HTMLDivElement>): Zona | null => {
    const i = indice(e)
    return i === null || !datos ? null : [...zonas].reverse().find((z) => (datos.zonas[z]?.[i] ?? 0) > 16) ?? null
  }
  // Solo se puede elegir lo que está en el catálogo.
  const lugarEn = (e: MouseEvent<HTMLDivElement>): string | null => {
    const i = indice(e)
    if (i === null || !datos || !zona) return null
    return [...lugares].reverse().find((l) => l.zona === zona && porCodigo.has(l.id) && (datos.lugares[l.id]?.[i] ?? 0) > 24)?.id ?? null
  }

  const b = zona ? limitesZona[zona] : null
  const escalaZona = b ? Math.min(2.4, 0.78 / Math.max(b.w / ancho, b.h / alto)) : 1
  const cx = b ? (b.x + b.w / 2) / ancho : 0.5
  const cy = b ? (b.y + b.h / 2) / alto : 0.5
  const transform = `translate(${(0.5 - cx * escalaZona) * 100}%, ${(0.5 - cy * escalaZona) * 100}%) scale(${escalaZona})`

  const activo = hoverLugar ?? seleccionada?.codigo ?? null
  const visibles = lugares.filter((l) => !zona || l.zona === zona)
  const centro = seleccionada?.codigo ? datos?.centros[seleccionada.codigo] : undefined
  const mostrarPin = centro && (!zona || zona === seleccionada?.zona)
  const resaltada = hoverZona ?? zona

  return (
    <Modal titulo="Elegir ubicación en el mapa" onCerrar={onCerrar} ancho="max-w-[800px]">
      <div className="relative h-[62vh] min-h-[450px] overflow-hidden rounded-tarjeta bg-[#EBECE8]">
        <div className="mapa-campus">
          <div className="mapa-controles">
            {zona && <button type="button" onClick={() => { setZona(null); setHoverLugar(null) }}><RotateCcw size={15} /> Vista completa</button>}
          </div>
          {zona && <div className="mapa-etiqueta-zona">Zona {zona}</div>}
          <div
            className="mapa-stage"
            style={{ transform: `translate(-50%, -50%) ${transform}`, cursor: zona ? (hoverLugar ? 'pointer' : 'default') : 'pointer' }}
            role="img"
            aria-label="Mapa del campus: elige una zona y luego un edificio, cancha o plazoleta"
            onMouseMove={(e) => { if (zona) setHoverLugar(lugarEn(e)); else setHoverZona(zonaEn(e)) }}
            onMouseLeave={() => { setHoverZona(null); setHoverLugar(null) }}
            onClick={(e) => {
              if (!zona) { const z = zonaEn(e); if (z) setZona(z); return }
              const codigo = lugarEn(e)
              const u = codigo ? porCodigo.get(codigo) : undefined
              if (u) onChange(u.id) // se guarda en el formulario al instante
            }}
          >
            {zonas.map((z) => (
              <img key={z} src={`/zones/zona${z}.png`} alt="" draggable="false"
                className={`mapa-zona${resaltada && z !== resaltada ? ' atenuada' : ''}${!zona && hoverZona === z ? ' levantada' : ''}`} />
            ))}
            {visibles.map((l) => {
              const esActivo = !!zona && activo === l.id
              return (
                <img key={l.id} src={l.src} alt="" draggable="false"
                  className={`mapa-edificio${esActivo ? ' resaltado' : zona && activo ? ' atenuada' : ''}${!zona && hoverZona === l.zona ? ' levantado' : ''}`} />
              )
            })}
            {mostrarPin && (
              <span
                className="mapa-pin"
                style={{
                  left: `${(centro.x / ancho) * 100}%`,
                  top: `${(centro.y / alto) * 100}%`,
                  pointerEvents: 'none',
                  // La punta del pin seleccionado está al 77 % de su alto (ver PinMapa): se ancla ahí al escalar.
                  transformOrigin: '50% 77%',
                  transform: `translate(-50%,-77%) scale(${1 / escalaZona})`,
                }}
              >
                <PinMapa color={color} seleccionado />
              </span>
            )}
          </div>
          {error && <p role="alert" className="mapa-error"><MapPin size={16} /> No se pudo cargar el plano del campus.</p>}
          {!datos && !error && <p className="mapa-pie" aria-busy="true">Cargando mapa…</p>}
          {datos && (
            <div className="mapa-pie">
              <span>{zona ? 'Toca un edificio, cancha o plazoleta' : 'Toca una zona para acercar'}</span>
              <span>{hoverLugar ? porCodigo.get(hoverLugar)?.nombre : ''}</span>
            </div>
          )}
        </div>
      </div>
      <p aria-live="polite" className="text-[13px] text-texto-secundario">
        {seleccionada ? <>Ubicación seleccionada: <strong className="font-semibold text-texto">{seleccionada.nombre}</strong></> : 'Aún no has elegido una ubicación.'}
      </p>
      <Boton type="button" onClick={onCerrar} disabled={!seleccionada}>Listo</Boton>
    </Modal>
  )
}
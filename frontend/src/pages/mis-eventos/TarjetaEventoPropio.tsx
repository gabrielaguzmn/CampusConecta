import { Ellipsis, EyeOff, MapPin } from 'lucide-react'
import { useNormas } from '../../api/queries'
import type { components } from '../../api/schema'
import { EstadoBadge } from '../../components/EstadoBadge'
import { Sesiones } from '../../components/Sesiones'
import { formatoDia, formatoDiaYHorario } from '../../lib/formato'

type Evento = components['schemas']['Evento']
type Fecha = components['schemas']['Fecha']

// RF-032 · PUBLICATION-2 · criterio 4: marca de oculto con su motivo (norma y explicación del administrador).
// Sin diseño en Figma (G-44); creada el 2026-10-07 con el estilo del badge «Cancelado».
function MarcaOculto({ evento }: { evento: Evento }) {
  const normas = useNormas()
  const motivos = [
    ...(evento.oculto ? [{ clave: 'evento', titulo: 'Evento oculto por moderación', norma: evento.norma_ocultamiento, explicacion: evento.explicacion_ocultamiento }] : []),
    ...evento.fechas
      .filter((f) => f.oculta)
      .map((f) => ({ clave: `fecha-${f.id}`, titulo: `Sesión del ${formatoDia(f.inicio)} oculta por moderación`, norma: f.norma_ocultamiento, explicacion: f.explicacion_ocultamiento })),
  ]
  if (!motivos.length) return null
  return (
    <div className="flex flex-col gap-3 rounded-control bg-badge-cancelado p-3 text-[13px] text-destructivo">
      {motivos.map(({ clave, titulo, norma, explicacion }) => {
        const nombre = normas.data?.find((n) => n.id === norma)?.nombre
        return (
          <div key={clave} className="flex gap-2">
            <EyeOff size={16} aria-hidden className="mt-px shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{titulo}</p>
              {norma != null && <p>Norma {norma}{nombre ? `: ${nombre}` : ''}</p>}
              {explicacion && <p>{explicacion}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Historial (Figma 4:29131): "✓ 28 Sep. · 17:00–18:30" y debajo "Finalizada"; la cancelada sigue la decisión G-45.
function FechaHistorial({ fecha }: { fecha: Fecha }) {
  const cuando = formatoDiaYHorario(fecha.inicio, fecha.fin)
  if (fecha.estado === 'cancelada') {
    return (
      <p className="text-[13px] text-destructivo">
        <span aria-hidden>×</span> <s>{cuando}</s>
        <br />
        Cancelada
      </p>
    )
  }
  return (
    <p className="text-[13px] text-metadatos">
      <span aria-hidden>✓</span> {cuando}
      <br />
      Finalizada
    </p>
  )
}

// PUBLICATION-2 · Figma 4:29036 / 4:29636 (Activos), 4:29131 / 4:29726 (Historial) · «Evento propio».
export function TarjetaEventoPropio({
  evento,
  historial = false,
  onGestionar,
  etiquetaGestion = `Gestionar ${evento.nombre}`,
}: {
  evento: Evento
  historial?: boolean
  onGestionar?: () => void
  etiquetaGestion?: string
}) {
  const unaFecha = evento.fechas.length === 1 ? evento.fechas[0] : undefined
  const lugar = [evento.detalle_ubicacion, evento.ubicacion.nombre].filter(Boolean).join(' · ')

  return (
    <article
      aria-label={evento.nombre}
      style={evento.categoria.color ? { borderLeftColor: evento.categoria.color } : undefined}
      className={`flex h-full flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta md:p-6 ${evento.categoria.color ? 'border-l-4' : ''}`}
    >
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-[13px] text-primario">{evento.categoria.nombre}</p>
          <h3 className="text-lg font-bold">{evento.nombre}</h3>
        </div>
        {/* G-52: en el Historial no hay menú (solo consulta, RF-018) */}
        {onGestionar && (
          <button type="button" onClick={onGestionar} aria-label={etiquetaGestion} className="flex size-11 shrink-0 items-center justify-center self-start text-texto-secundario">
            <Ellipsis size={24} aria-hidden />
          </button>
        )}
      </div>
      <p className="flex items-center gap-2 text-[13px] text-texto-secundario">
        <MapPin size={16} aria-hidden className="shrink-0 text-metadatos" />
        {lugar}
      </p>
      <MarcaOculto evento={evento} />
      <hr className="border-borde" />
      {unaFecha && historial ? (
        <FechaHistorial fecha={unaFecha} />
      ) : unaFecha ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-texto-secundario">{formatoDiaYHorario(unaFecha.inicio, unaFecha.fin)}</p>
          {unaFecha.estado !== 'finalizada' && <EstadoBadge estado={unaFecha.estado} />}
        </div>
      ) : (
        <Sesiones fechas={evento.fechas} className="gap-2" />
      )}
    </article>
  )
}

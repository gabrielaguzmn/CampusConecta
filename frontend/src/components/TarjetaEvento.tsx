import { Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import type { components } from '../api/schema'
import { formatoDiaYHorario, formatoHorario } from '../lib/formato'
import { EstadoBadge } from './EstadoBadge'
import { Sesiones } from './Sesiones'

type Evento = components['schemas']['EventoPublico']

// Figma 4:30135 · Cards de eventos (5:17–5:18):
// "Imagen cover · Categoría sobre imagen · Franja lateral · Un evento, una tarjeta; las fechas viven en Sesiones."
export function TarjetaEvento({ evento }: { evento: Evento }) {
  const unaFecha = evento.fechas.length === 1 ? evento.fechas[0] : undefined
  // Figma muestra "Sala de arte · Edificio C": detalle de ubicación (RF-010) y ubicación del catálogo (RF-009).
  const lugar = [evento.detalle_ubicacion, evento.ubicacion.nombre].filter(Boolean).join(' · ')

  return (
    // Franja lateral de 4 px con el color de la categoría (CONTRATO-01, decisión G-54).
    <article
      style={evento.categoria.color ? { borderLeftColor: evento.categoria.color } : undefined}
      className={`relative flex h-full flex-col overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta transition-shadow hover:shadow-elevada ${evento.categoria.color ? 'border-l-4' : ''}`}
    >
      <div className="relative h-40 bg-primario">
        {/* G-55 (decisión 2026-10-07): sin imagen, el bloque queda en Primario #950000 de la paleta de Figma */}
        {evento.imagen && <img src={evento.imagen} alt="" className="h-full w-full object-cover" />}
        <span className="absolute top-4 left-4 rounded-pildora bg-texto/70 px-3 py-1.5 text-[13px] font-semibold text-white">
          {evento.categoria.nombre}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-bold text-texto">
            {/* Toda la tarjeta lleva al detalle (pantalla creada el 2026-10-07, G-12); Figma ya marca el hover elevado. */}
            <Link to={`/eventos/${evento.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-tarjeta focus-visible:after:outline-3 focus-visible:after:outline-primario">
              {evento.nombre}
            </Link>
          </h3>
          {unaFecha && unaFecha.estado !== 'finalizada' && <EstadoBadge estado={unaFecha.estado} />}
        </div>
        <p className="line-clamp-2 text-sm leading-[1.45] text-texto-secundario">{evento.descripcion}</p>
        <hr className="border-borde" />
        <div className="flex flex-col gap-2 text-[13px] text-texto-secundario md:flex-row md:justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin size={16} aria-hidden className="text-metadatos" />
            {lugar}
          </span>
          {unaFecha ? (
            <span className="hidden items-center gap-1.5 md:flex">
              <Clock size={16} aria-hidden className="text-metadatos" />
              {formatoHorario(unaFecha.inicio, unaFecha.fin)}
            </span>
          ) : (
            // TODO(PENDIENTE G-45: qué horario muestra una tarjeta con varias sesiones)
            null
          )}
        </div>
        {unaFecha ? (
          <p className="text-[13px] text-texto-secundario">{formatoDiaYHorario(unaFecha.inicio, unaFecha.fin)}</p>
        ) : (
          <Sesiones fechas={evento.fechas} />
        )}
      </div>
    </article>
  )
}

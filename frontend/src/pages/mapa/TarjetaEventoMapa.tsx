import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { components } from '../../api/schema'
import { Boton } from '../../components/Boton'
import { Sesiones } from '../../components/Sesiones'

type EventoMapa = components['schemas']['EventoMapa']

// INTERACTIVITY-2 · criterio 1 · Figma 4:29322 / 4:29909 · "Tarjeta de evento seleccionado".
// Figma muestra "16:00–18:00 · Sala de arte" con reloj; por la decisión G-45 cada sesión ya lleva su horario,
// así que aquí queda solo el detalle de ubicación, y únicamente si el organizador lo indicó (INTERACTIVITY-3 · criterio 2).
export function TarjetaEventoMapa({ evento, className = '' }: { evento: EventoMapa; className?: string }) {
  const navegar = useNavigate()
  return (
    <article aria-label={evento.nombre} className={`flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-elevada ${className}`}>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold text-primario">{evento.categoria.nombre}</p>
        <h2 className="text-lg font-bold">{evento.nombre}</h2>
      </div>
      {evento.detalle_ubicacion && (
        <p className="flex items-center gap-2 text-[13px] text-texto-secundario">
          <MapPin size={16} aria-hidden className="text-metadatos" />
          {evento.detalle_ubicacion}
        </p>
      )}
      <Sesiones fechas={evento.fechas} />
      {/* INTERACTIVITY-2 · criterio 2: detalle completo (pantalla creada el 2026-10-07, G-12) */}
      <Boton onClick={() => navegar(`/eventos/${evento.id}`)}>Ver más</Boton>
    </article>
  )
}

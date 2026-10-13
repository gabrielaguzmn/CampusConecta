import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, DoorOpen, ExternalLink, Flag, MapPin, Maximize2, MessageCircle, User, Users } from 'lucide-react'
import { useEvento } from '../../api/queries'
import { EstadoBadge } from '../../components/EstadoBadge'
import { Modal } from '../../components/Modal'
import { Sesiones } from '../../components/Sesiones'
import { ReportarEvento } from './ReportarEvento'

// Pantalla sin diseño en Figma (G-12), creada el 2026-10-07 con el estilo de las tarjetas, el feed y el mapa.
// INTERACTIVITY-2 · criterio 2 y 3, INTERACTIVITY-3, DISPLAY-3.
function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-metadatos">{icono}</span>
      <div className="flex flex-col gap-1">
        <dt className="text-[13px] font-semibold text-texto">{etiqueta}</dt>
        <dd className="text-[13px] break-words text-texto-secundario">{children}</dd>
      </div>
    </div>
  )
}

export function EventoPage() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const consulta = useEvento(id)
  const [reportando, setReportando] = useState(false)
  const [imagenCompleta, setImagenCompleta] = useState(false)
  const [imagenFallo, setImagenFallo] = useState(false)
  const evento = consulta.data
  const unaFecha = evento?.fechas.length === 1 ? evento.fechas[0] : undefined

  return (
    <main className="flex flex-col gap-6 px-4 py-8 md:px-8 xl:px-20">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navegar(-1) : navegar('/feed'))}
        className="flex items-center gap-2 self-start text-sm font-semibold text-primario"
      >
        <ArrowLeft size={18} aria-hidden />
        Volver
      </button>

      {consulta.isPending && <div aria-busy="true" aria-label="Cargando evento" className="h-[480px] animate-pulse rounded-tarjeta bg-borde" />}
      {consulta.isError && (
        <p role="alert" className="text-sm text-texto-secundario">
          No pudimos cargar el evento.{' '}
          <button type="button" onClick={() => consulta.refetch()} className="font-semibold text-primario">
            Intenta de nuevo.
          </button>
        </p>
      )}
      {consulta.data === null && (
        // G-38: el evento ya no es vigente o fue ocultado.
        <p className="text-sm text-texto-secundario">
          Este evento ya no está disponible.{' '}
          <Link to="/feed" className="font-semibold text-primario">
            Volver al Feed
          </Link>
        </p>
      )}

      {evento && (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <article
            style={evento.categoria.color ? { borderLeftColor: evento.categoria.color } : undefined}
            className={`overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta ${evento.categoria.color ? 'border-l-4' : ''}`}
          >
            <div
              // Decisión 2026-10-11: igual que en la tarjeta del feed, el color de la categoría queda detrás de la imagen
              // y se ve si no hay imagen o si no carga.
              style={evento.categoria.color ? { backgroundColor: evento.categoria.color } : undefined}
              className={`relative h-56 md:h-80 ${evento.categoria.color ? '' : 'bg-primario'}`}
            >
              {evento.imagen && !imagenFallo && (
                // Decisión 2026-10-11: la portada recorta la imagen; al pulsarla se ve completa (p. ej. un flyer).
                <button
                  type="button"
                  onClick={() => setImagenCompleta(true)}
                  aria-label="Ver imagen completa"
                  className="group block h-full w-full cursor-zoom-in focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-primario"
                >
                  <img src={evento.imagen} alt="" className="h-full w-full object-cover" onError={() => setImagenFallo(true)} />
                  <span className="absolute right-4 bottom-4 flex items-center gap-1.5 rounded-pildora bg-texto/70 px-3 py-1.5 text-[13px] font-semibold text-white group-hover:bg-texto/85">
                    <Maximize2 size={14} aria-hidden />
                    Ver imagen completa
                  </span>
                </button>
              )}
              <span className="absolute top-4 left-4 rounded-pildora bg-texto/70 px-3 py-1.5 text-[13px] font-semibold text-white">
                {evento.categoria.nombre}
              </span>
            </div>
            <div className="flex flex-col gap-4 p-5 md:p-8">
              <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold md:text-[32px]">{evento.nombre}</h1>
                {unaFecha && unaFecha.estado !== 'finalizada' && <EstadoBadge estado={unaFecha.estado} />}
              </div>
              <p className="text-base leading-[1.6] whitespace-pre-line text-texto-secundario">{evento.descripcion}</p>
            </div>
          </article>

          <aside className="flex flex-col gap-5 rounded-tarjeta bg-superficie p-5 shadow-tarjeta md:p-6">
            {/* INTERACTIVITY-2 · criterio 3: cada fecha con su día, horario y estado (G-45) */}
            <Sesiones fechas={evento.fechas} />
            <hr className="border-borde" />
            <dl className="flex flex-col gap-4">
              <Dato icono={<MapPin size={16} />} etiqueta="Ubicación">
                {evento.ubicacion.nombre}
              </Dato>
              {/* INTERACTIVITY-3 · criterio 1 y 2: solo si el organizador lo indicó */}
              {evento.detalle_ubicacion && (
                <Dato icono={<DoorOpen size={16} />} etiqueta="Detalle de ubicación">
                  {evento.detalle_ubicacion}
                </Dato>
              )}
              <Dato icono={<User size={16} />} etiqueta="Responsable">
                {evento.responsable}
              </Dato>
              {evento.cupo != null && (
                <Dato icono={<Users size={16} />} etiqueta="Cupo">
                  {evento.cupo}
                </Dato>
              )}
              {evento.contacto && (
                <Dato icono={<MessageCircle size={16} />} etiqueta="Contacto">
                  {evento.contacto}
                </Dato>
              )}
              {evento.enlace_externo && (
                <Dato icono={<ExternalLink size={16} />} etiqueta="Enlace">
                  <a href={evento.enlace_externo} target="_blank" rel="noopener noreferrer" className="font-semibold text-primario underline">
                    {evento.enlace_externo}
                  </a>
                </Dato>
              )}
            </dl>
            <hr className="border-borde" />
            {/* DISPLAY-3: reportar desde el detalle */}
            <button type="button" onClick={() => setReportando(true)} className="flex items-center gap-2 self-start text-sm font-semibold text-primario">
              <Flag size={16} aria-hidden />
              Reportar evento
            </button>
          </aside>
        </div>
      )}
      {reportando && evento && <ReportarEvento eventoId={evento.id} onCerrar={() => setReportando(false)} />}
      {imagenCompleta && evento?.imagen && (
        <Modal titulo={evento.nombre} onCerrar={() => setImagenCompleta(false)} ancho="max-w-[1000px]" className="p-4 md:p-6">
          <img src={evento.imagen} alt={`Imagen de ${evento.nombre}`} className="max-h-[80vh] w-full rounded-control object-contain" />
        </Modal>
      )}
    </main>
  )
}

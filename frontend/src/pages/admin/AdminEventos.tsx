import { useState } from 'react'
import { useEventosAdmin, useRefrescar } from '../../api/admin'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { AccionModal } from '../../components/AccionModal'
import { Chip } from '../../components/Chip'
import { Modal } from '../../components/Modal'
import { Sesiones } from '../../components/Sesiones'
import { formatoDiaYHorario } from '../../lib/formato'
import { TarjetaEventoPropio } from '../mis-eventos/TarjetaEventoPropio'
import { Cargando, Errores, ModalMotivo, useAccion } from './comunes'

type Evento = components['schemas']['Evento']
type Objetivo = { tipo: 'evento' } | { tipo: 'fecha'; id: number; cuando: string }

// ADMIN-1 · RF-025, RF-032: revisar, ocultar y restaurar eventos o fechas, salvo fechas ya finalizadas.
// La eliminación por moderación no está en el contrato (G-24): no se ofrece.
function ModerarEvento({ evento, onCerrar }: { evento: Evento; onCerrar: () => void }) {
  const refrescar = useRefrescar()
  const { enviando, errores, ejecutar } = useAccion()
  const [ocultar, setOcultar] = useState<Objetivo>()
  const moderables = evento.fechas.filter((f) => f.estado !== 'finalizada') // ADMIN-1 · criterio 3

  if (ocultar) {
    return (
      <ModalMotivo
        titulo={ocultar.tipo === 'evento' ? 'Ocultar evento' : 'Ocultar sesión'}
        texto={
          ocultar.tipo === 'evento'
            ? `«${evento.nombre}» dejará de verse en el mapa y el feed. Su creador verá el motivo y recibirá un correo.`
            : `La sesión del ${ocultar.cuando} dejará de verse. Su creador verá el motivo y recibirá un correo.`
        }
        boton={ocultar.tipo === 'evento' ? 'Ocultar evento' : 'Ocultar sesión'}
        onCerrar={onCerrar}
        onConfirmar={async (motivo) => {
          const r =
            ocultar.tipo === 'evento'
              ? await api.POST('/api/admin/eventos/{id}/ocultar/', { params: { path: { id: evento.id } }, body: motivo })
              : await api.POST('/api/admin/fechas/{id}/ocultar/', { params: { path: { id: ocultar.id } }, body: motivo })
          if (r.response.ok) await refrescar()
          return r
        }}
      />
    )
  }

  return (
    <Modal titulo="Moderar evento" onCerrar={onCerrar}>
      <p className="text-lg font-bold">{evento.nombre}</p>
      <Sesiones fechas={evento.fechas} className="gap-2" />
      <hr className="border-borde" />
      <Errores mensajes={errores} />
      <div className="flex flex-col gap-2">
        {evento.oculto ? (
          <AccionModal
            disabled={enviando}
            onClick={() => ejecutar(() => api.POST('/api/admin/eventos/{id}/restaurar/', { params: { path: { id: evento.id } } }), async () => (await refrescar(), onCerrar()))}
          >
            Restaurar evento
          </AccionModal>
        ) : (
          <AccionModal variante="destructiva" onClick={() => setOcultar({ tipo: 'evento' })}>
            Ocultar evento
          </AccionModal>
        )}
        {moderables.map((f) => {
          const cuando = formatoDiaYHorario(f.inicio, f.fin)
          return f.oculta ? (
            <AccionModal
              key={f.id}
              disabled={enviando}
              onClick={() => ejecutar(() => api.POST('/api/admin/fechas/{id}/restaurar/', { params: { path: { id: f.id } } }), async () => (await refrescar(), onCerrar()))}
            >
              Restaurar sesión del {cuando}
            </AccionModal>
          ) : (
            <AccionModal key={f.id} variante="destructiva" onClick={() => setOcultar({ tipo: 'fecha', id: f.id, cuando })}>
              Ocultar sesión del {cuando}
            </AccionModal>
          )
        })}
      </div>
    </Modal>
  )
}

export function AdminEventos() {
  const [oculto, setOculto] = useState<boolean>()
  const eventos = useEventosAdmin(oculto)
  const [moderando, setModerando] = useState<Evento>()
  return (
    <section className="flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto rounded-tarjeta bg-superficie p-4 [scrollbar-width:none]">
        <Chip activo={oculto === undefined} onClick={() => setOculto(undefined)}>
          Todos
        </Chip>
        <Chip activo={oculto === false} onClick={() => setOculto(false)}>
          Visibles
        </Chip>
        <Chip activo={oculto === true} onClick={() => setOculto(true)}>
          Ocultos
        </Chip>
      </div>
      <Cargando consulta={eventos} vacio={eventos.data?.length === 0}>
        <ul className="grid gap-6 md:grid-cols-2">
          {eventos.data?.map((e) => (
            <li key={e.id}>
              <TarjetaEventoPropio evento={e} onGestionar={() => setModerando(e)} etiquetaGestion={`Moderar ${e.nombre}`} />
            </li>
          ))}
        </ul>
      </Cargando>
      {moderando && <ModerarEvento evento={moderando} onCerrar={() => setModerando(undefined)} />}
    </section>
  )
}

import { useState } from 'react'
import { useCasos, useRefrescar, type Caso, type EstadoCaso } from '../../api/admin'
import { api } from '../../api/client'
import { useNormas } from '../../api/queries'
import { AccionModal } from '../../components/AccionModal'
import { Chip } from '../../components/Chip'
import { Modal } from '../../components/Modal'
import { Cargando, Errores, ModalMotivo, Pildora, useAccion } from './comunes'

// ADMIN-2 · RF-026, RF-031: casos agrupados por evento con estados pendiente por revisión, en revisión y revisado.
const ESTADOS: Record<EstadoCaso, string> = { pendiente: 'Pendiente por revisión', en_revision: 'En revisión', revisado: 'Revisado' }

function TarjetaCaso({ caso }: { caso: Caso }) {
  const normas = useNormas()
  const refrescar = useRefrescar()
  const { enviando, errores, ejecutar } = useAccion()
  const [decidiendo, setDecidiendo] = useState(false)
  const [ocultando, setOcultando] = useState(false)
  const estado = caso.estado ?? 'pendiente'
  const ruta = { params: { path: { id: caso.id } } }

  return (
    <article aria-label={`Caso de ${caso.evento.nombre}`} className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold">{caso.evento.nombre}</h3>
          <p className="text-[13px] text-texto-secundario">
            Creado por {caso.evento.creador.nombre} · {caso.evento.creador.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pildora tono={estado === 'revisado' ? 'neutro' : 'suave'}>{ESTADOS[estado]}</Pildora>
          {estado === 'revisado' && <Pildora tono={caso.decision_ocultar ? 'alerta' : 'ok'}>{caso.decision_ocultar ? 'Evento oculto' : 'Evento visible'}</Pildora>}
        </div>
      </div>
      <hr className="border-borde" />
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold">
          {caso.reportes.length} {caso.reportes.length === 1 ? 'reporte' : 'reportes'}
        </p>
        <ul className="flex flex-col gap-3">
          {caso.reportes.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 rounded-control bg-fondo p-3 text-[13px]">
              <span className="font-semibold">
                Norma {r.causa}
                {normas.data ? `: ${normas.data.find((n) => n.id === r.causa)?.nombre ?? ''}` : ''}
              </span>
              <span className="text-texto-secundario">{r.usuario.nombre}</span>
              {r.detalles && <span className="text-texto-secundario">{r.detalles}</span>}
            </li>
          ))}
        </ul>
      </div>
      <Errores mensajes={errores} />
      {/* ADMIN-2 · criterio 2: pendiente → en revisión → revisado */}
      {estado === 'pendiente' && (
        <AccionModal disabled={enviando} onClick={() => ejecutar(() => api.PATCH('/api/admin/casos/{id}/', { ...ruta, body: { estado: 'en_revision', explicacion: '' } }), refrescar)}>
          Pasar a revisión
        </AccionModal>
      )}
      {estado === 'en_revision' && (
        <AccionModal variante="principal" onClick={() => setDecidiendo(true)}>
          Marcar como revisado
        </AccionModal>
      )}

      {/* ADMIN-2 · criterio 3: al revisar se decide si el evento se oculta */}
      {decidiendo && (
        <Modal titulo="Decisión del caso" onCerrar={() => setDecidiendo(false)}>
          <p className="text-sm text-texto-secundario">¿El evento «{caso.evento.nombre}» incumple las normas de uso?</p>
          <Errores mensajes={errores} />
          <div className="flex flex-col gap-2">
            <AccionModal variante="destructiva" onClick={() => (setDecidiendo(false), setOcultando(true))}>
              Ocultar el evento
            </AccionModal>
            <AccionModal
              disabled={enviando}
              onClick={() =>
                ejecutar(
                  () => api.PATCH('/api/admin/casos/{id}/', { ...ruta, body: { estado: 'revisado', decision_ocultar: false, explicacion: '' } }),
                  async () => (await refrescar(), setDecidiendo(false)),
                )
              }
            >
              Mantener visible
            </AccionModal>
          </div>
        </Modal>
      )}
      {ocultando && (
        <ModalMotivo
          titulo="Ocultar evento"
          texto="El evento dejará de verse en el mapa y el feed. Su creador verá la marca de oculto con este motivo y recibirá un correo."
          boton="Ocultar evento"
          onCerrar={() => setOcultando(false)}
          onConfirmar={async (motivo) => {
            const r = await api.PATCH('/api/admin/casos/{id}/', { ...ruta, body: { estado: 'revisado', decision_ocultar: true, ...motivo } })
            if (r.response.ok) await refrescar()
            return r
          }}
        />
      )}
    </article>
  )
}

export function AdminReportes() {
  const [estado, setEstado] = useState<EstadoCaso>()
  const casos = useCasos(estado)
  return (
    <section className="flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto rounded-tarjeta bg-superficie p-4 [scrollbar-width:none]">
        <Chip activo={!estado} onClick={() => setEstado(undefined)}>
          Todos
        </Chip>
        {(Object.keys(ESTADOS) as EstadoCaso[]).map((e) => (
          <Chip key={e} activo={estado === e} onClick={() => setEstado(e)}>
            {ESTADOS[e]}
          </Chip>
        ))}
      </div>
      <Cargando consulta={casos} vacio={casos.data?.length === 0}>
        <ul className="grid gap-6 md:grid-cols-2">
          {casos.data?.map((c) => (
            <li key={c.id}>
              <TarjetaCaso caso={c} />
            </li>
          ))}
        </ul>
      </Cargando>
    </section>
  )
}

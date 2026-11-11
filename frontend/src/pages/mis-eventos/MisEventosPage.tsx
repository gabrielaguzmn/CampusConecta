import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMisEventos } from '../../api/queries'
import type { components } from '../../api/schema'
import { Boton } from '../../components/Boton'
import { Tabs } from '../../components/Tabs'
import { FormularioEvento } from './FormularioEvento'
import { GestionarEvento } from './GestionarEvento'
import { TarjetaEventoPropio } from './TarjetaEventoPropio'

type Evento = components['schemas']['Evento']
type Modal = { tipo: 'crear' } | { tipo: 'gestionar'; evento: Evento } | { tipo: 'editar'; evento: Evento }

const PESTANAS = [
  { etiqueta: 'Eventos Activos', a: '/mis-eventos' },
  { etiqueta: 'Historial (Finalizados)', a: '/mis-eventos/historial' },
]

// PUBLICATION-2 · Figma 4:29036 / 4:29636 (Activos) y 4:29131 / 4:29726 (Historial)
export function MisEventosPage({ historial = false, abrirCrear = false }: { historial?: boolean; abrirCrear?: boolean }) {
  const navigate = useNavigate()
  const consulta = useMisEventos(historial ? 'historial' : 'vigentes')
  const [modal, setModal] = useState<Modal | undefined>(abrirCrear ? { tipo: 'crear' } : undefined)
  const eventos = consulta.data
  const crear = () => setModal({ tipo: 'crear' })

  return (
    <main className="flex flex-col gap-6 px-4 py-8 md:px-8 xl:px-20">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-bold">Mis Eventos</h1>
          <p className="text-sm text-texto-secundario md:text-base">
            {historial ? (
              <>
                <span className="md:hidden">Tus actividades, en un solo lugar.</span>
                <span className="hidden md:inline">Consulta las actividades y sesiones que ya pasaron.</span>
              </>
            ) : (
              'Tus actividades, en un solo lugar.'
            )}
          </p>
        </div>
        {/* «Crear evento» en ambas pestañas y anchos (capturas de docs/referencias; corrige I-05) */}
        <Boton onClick={crear} className="h-19 w-full text-lg md:h-12 md:w-[180px]">
          Crear evento
        </Boton>
      </header>

      <Tabs pestanas={PESTANAS} />

      {consulta.isPending && (
        <ul aria-busy="true" aria-label="Cargando eventos" className={`grid gap-6 ${historial ? '' : 'md:grid-cols-2'}`}>
          {[0, 1].map((i) => (
            <li key={i} className="h-[186px] animate-pulse rounded-tarjeta bg-borde" />
          ))}
        </ul>
      )}
      {consulta.isError && (
        <p role="alert" className="text-sm text-texto-secundario">
          No pudimos cargar tus eventos.{' '}
          <button type="button" onClick={() => consulta.refetch()} className="font-semibold text-primario">
            Intenta de nuevo.
          </button>
        </p>
      )}
      {eventos && (
        <>
          <p className="text-sm text-texto-secundario">
            {historial
              ? `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'} en el historial`
              : `${eventos.length} ${eventos.length === 1 ? 'evento activo' : 'eventos activos'}`}
          </p>
          {/* Historial Desktop en una columna (4:29131); Activos en dos (4:29036). */}
          <ul className={`grid gap-6 ${historial ? '' : 'md:grid-cols-2'}`}>
            {eventos.map((evento) => (
              <li key={evento.id}>
                <TarjetaEventoPropio
                  evento={evento}
                  historial={historial}
                  onGestionar={historial ? undefined : () => setModal({ tipo: 'gestionar', evento })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {modal?.tipo === 'crear' && <FormularioEvento onCerrar={() => {
        setModal(undefined)
        if (abrirCrear) navigate('/mis-eventos', { replace: true })
      }} />}
      {modal?.tipo === 'editar' && <FormularioEvento evento={modal.evento} onCerrar={() => setModal(undefined)} />}
      {modal?.tipo === 'gestionar' && (
        <GestionarEvento
          evento={modal.evento}
          onEditar={() => setModal({ tipo: 'editar', evento: modal.evento })}
          onCerrar={() => setModal(undefined)}
        />
      )}
    </main>
  )
}

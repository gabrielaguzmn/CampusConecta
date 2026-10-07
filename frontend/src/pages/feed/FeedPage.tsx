import { useSearchParams } from 'react-router'
import { useCategorias, useEventos, type FiltrosFeed } from '../../api/queries'
import { Buscador, coincide, useBusqueda } from '../../components/Buscador'
import { Chip } from '../../components/Chip'
import { TarjetaEvento } from '../../components/TarjetaEvento'
import { formatoMesActual } from '../../lib/formato'

type Estado = NonNullable<FiltrosFeed['estado']>
const ESTADOS: { valor: Estado; etiqueta: string }[] = [
  { valor: 'proxima', etiqueta: 'Próximos' },
  { valor: 'en_vivo', etiqueta: 'En vivo' },
]

// Filtros en la URL (?categoria=&estado=) para que sobrevivan a la recarga (02_arquitectura.md §6).
function useFiltros() {
  const [parametros, setParametros] = useSearchParams()
  const categoria = Number(parametros.get('categoria')) || undefined
  const estadoUrl = parametros.get('estado')
  const estado = ESTADOS.find((e) => e.valor === estadoUrl)?.valor

  function cambiar(clave: 'categoria' | 'estado', valor?: string) {
    setParametros(
      (actuales) => {
        if (valor) actuales.set(clave, valor)
        else actuales.delete(clave)
        return actuales
      },
      { replace: true },
    )
  }
  return { filtros: { categoria, estado } satisfies FiltrosFeed, cambiar }
}

// DISPLAY-1 y DISPLAY-2 · Figma 4:28896 (Desktop), 4:30004 (Tablet), 4:29507 (Mobile)
export function FeedPage() {
  const { filtros, cambiar } = useFiltros()
  const categorias = useCategorias()
  const eventos = useEventos(filtros)
  const { texto } = useBusqueda()
  const visibles = eventos.data?.filter((evento) => coincide(evento, texto))

  return (
    <main className="flex flex-col gap-6 px-4 py-8 md:px-8 xl:px-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold">Descubre tu campus</h1>
        <p className="text-sm text-texto-secundario md:text-base">Planes, ideas y encuentros que hacen comunidad.</p>
      </header>
      {/* En Mobile el buscador va aquí (Figma 4:29507); desde Tablet está en la barra. */}
      <Buscador className="h-12 bg-superficie md:hidden" />

      <section className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-4">
        {/* G-47 (decisión 2026-10-07): nombres del catálogo de la API y una sola categoría a la vez. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <Chip activo={!filtros.categoria} onClick={() => cambiar('categoria')}>
            Todos
          </Chip>
          {categorias.data?.map((c) => (
            <Chip key={c.id} activo={filtros.categoria === c.id} onClick={() => cambiar('categoria', String(c.id))}>
              {c.nombre}
            </Chip>
          ))}
        </div>
        {/* DISPLAY-2 · criterio 3. Sin estado marcado se ven ambos; pulsar el activo lo retira (DoD: retiro de filtros).
            TODO(PENDIENTE G-47: efecto de "Todos" sobre el filtro de estado) */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-texto-secundario">Estado</span>
          {ESTADOS.map(({ valor, etiqueta }) => (
            <Chip key={valor} activo={filtros.estado === valor} onClick={() => cambiar('estado', filtros.estado === valor ? undefined : valor)}>
              {etiqueta}
            </Chip>
          ))}
        </div>
      </section>

      {/* G-51 (decisión 2026-10-07): tarjetas grises mientras carga y mensaje con reintento si falla. */}
      {eventos.isPending && (
        <ul aria-busy="true" aria-label="Cargando eventos" className="grid gap-6 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[328px] animate-pulse rounded-tarjeta bg-borde" />
          ))}
        </ul>
      )}
      {eventos.isError && (
        <p role="alert" className="text-sm text-texto-secundario">
          No pudimos cargar los eventos.{' '}
          <button type="button" onClick={() => eventos.refetch()} className="font-semibold text-primario">
            Intenta de nuevo.
          </button>
        </p>
      )}
      {visibles && (
        <>
          <div className="flex items-center justify-between">
            {/* Con 0 eventos, el resumen de Figma ya explica el estado vacío (DISPLAY-2 · DoD) */}
            <p className="text-sm font-semibold">
              {visibles.length} {visibles.length === 1 ? 'evento' : 'eventos'} en tu campus
            </p>
            <p className="text-[13px] text-texto-secundario">{formatoMesActual()}</p>
          </div>
          <ul className="grid gap-6 md:grid-cols-2">
            {visibles.map((evento) => (
              <li key={evento.id}>
                <TarjetaEvento evento={evento} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

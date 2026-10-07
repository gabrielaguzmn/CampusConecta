import { useState } from 'react'
import { useCategorias, useMapa } from '../../api/queries'
import { LeyendaCategorias } from './LeyendaCategorias'
import { MapaCampus } from './MapaCampus'
import { TarjetaEventoMapa } from './TarjetaEventoMapa'

// INTERACTIVITY-1 e INTERACTIVITY-2 · Figma 4:29322 (Desktop), 4:29909 (Mobile)
export function MapaPage() {
  const mapa = useMapa()
  const categorias = useCategorias()
  const [seleccionado, setSeleccionado] = useState<number>()
  const evento = mapa.data?.flatMap((u) => u.eventos).find((e) => e.id === seleccionado)

  return (
    <main className="flex flex-col gap-6 px-4 py-8 md:px-8 xl:px-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold">Explora el campus</h1>
        <p className="text-sm text-texto-secundario">Encuentra las actividades cerca de ti.</p>
      </header>

      <section aria-label="Mapa del campus" className="relative h-[650px] overflow-hidden rounded-tarjeta bg-[#EBECE8] md:h-[620px]">
        {mapa.data && <MapaCampus ubicaciones={mapa.data} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />}
        <div className="absolute top-4 left-4">
          <LeyendaCategorias categorias={categorias.data ?? []} />
        </div>
        {/* G-51: mismo patrón que el Feed si la consulta falla */}
        {mapa.isError && (
          <p role="alert" className="absolute inset-x-4 bottom-4 rounded-control bg-superficie p-4 text-sm text-texto-secundario">
            No pudimos cargar los eventos.{' '}
            <button type="button" onClick={() => mapa.refetch()} className="font-semibold text-primario">
              Intenta de nuevo.
            </button>
          </p>
        )}
        {evento && (
          // La integración puede ubicarla junto al pin, como en Desktop (Figma 4:29322); en Mobile va abajo (4:29909).
          <TarjetaEventoMapa evento={evento} className="absolute inset-x-4 bottom-12 md:inset-x-auto md:right-16 md:bottom-auto md:top-16 md:w-[348px]" />
        )}
      </section>
    </main>
  )
}

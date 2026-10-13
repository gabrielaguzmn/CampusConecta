import type { components } from '../../api/schema'

type Categoria = components['schemas']['Categoria']

// Figma 4:29322 · "Leyenda". El color de cada categoría viene de la API (CONTRATO-01) y va con su nombre (regla 7).
export function LeyendaCategorias({ categorias }: { categorias: Categoria[] }) {
  return (
    <section className="flex w-[174px] flex-col gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta md:w-[190px]">
      <h2 className="text-sm font-semibold">Categorías</h2>
      <ul className="flex flex-col gap-3">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[13px] text-texto-secundario">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? undefined }} />
            {c.nombre}
          </li>
        ))}
      </ul>
    </section>
  )
}

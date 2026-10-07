import type { ReactNode } from 'react'

// Login, Registro y Recuperación comparten estructura: Figma 4:28777 / 4:29421, 4:28815 / 4:29448, 4:28862 / 4:29484.
// Desktop: panel "Vida en el campus" (648 de 1440) con foto y "Tinte institucional". Mobile: bloque "Identidad".
function PanelCampus() {
  return (
    <aside className="relative hidden w-[45%] shrink-0 flex-col justify-between overflow-hidden bg-primario p-12 text-white xl:flex">
      <img src="/campus.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* Degradado de la capa "Tinte institucional" (4:28780) */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(149_0_0/0.72)_0%,rgb(99_30_30/0.75)_50%,rgb(73_0_0/0.95)_100%)]" />
      <p className="relative text-2xl font-bold tracking-[-0.7px]">CampusConecta</p>
      <div className="relative flex flex-col gap-6 pb-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[1.4px]">
          <span aria-hidden className="h-0.5 w-8 bg-white" />
          TU CAMPUS, TU COMUNIDAD
        </p>
        <p className="text-[32px] leading-[1.25] font-bold whitespace-pre-line">{'La vida universitaria\nva más allá del aula.'}</p>
        <p className="max-w-[440px] text-base leading-[1.6]">
          Descubre actividades, comparte tus intereses y conecta con quienes hacen de tu campus un lugar único.
        </p>
        <p className="flex gap-6 text-[13px]">
          <span>Cultura</span>
          <span>Deportes</span>
          <span>Comunidad</span>
        </p>
      </div>
    </aside>
  )
}

export function LayoutAcceso({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-fondo">
      <PanelCampus />
      <main className="flex flex-1 flex-col items-center gap-8 px-4 py-8 xl:justify-center xl:p-8">
        <div className="flex w-full max-w-[448px] flex-col gap-2 px-2 xl:hidden">
          <p className="text-2xl font-bold tracking-[-0.7px] text-primario">CampusConecta</p>
          <p className="text-[13px] text-texto-secundario">Tu campus, tu comunidad.</p>
        </div>
        <section className="flex w-full max-w-[448px] flex-col gap-6 rounded-tarjeta bg-superficie p-6 shadow-tarjeta xl:p-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold xl:text-[32px]">{titulo}</h1>
            <p className="text-sm text-texto-secundario">{descripcion}</p>
          </header>
          {children}
        </section>
        <p className="text-[13px] text-texto-secundario">CampusConecta · Comunidad universitaria</p>
      </main>
    </div>
  )
}

/** Mensaje general de la API; mismo estilo que el error de input (Figma 4:30135 · Input / Error). */
export function ErrorFormulario({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="text-[13px] text-primario">
      {mensaje}
    </p>
  )
}

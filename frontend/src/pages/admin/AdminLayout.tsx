import { Navigate, Outlet } from 'react-router'
import { useSesion } from '../../auth/AuthProvider'
import { Tabs } from '../../components/Tabs'

// RF-024: el módulo de administración solo es accesible para el rol administrador.
// La API también lo restringe; este guard evita mostrar la pantalla.
export function RequiereAdmin() {
  const { usuario } = useSesion()
  if (!usuario?.es_administrador) return <Navigate to="/feed" replace />
  return <Outlet />
}

const PESTANAS = [
  { etiqueta: 'Reportes', a: '/admin' },
  { etiqueta: 'Eventos', a: '/admin/eventos' },
  { etiqueta: 'Usuarios', a: '/admin/usuarios' },
  { etiqueta: 'Categorías', a: '/admin/categorias' },
  { etiqueta: 'Registro', a: '/admin/registro' },
]

export function AdminLayout() {
  return (
    <main className="flex flex-col gap-6 px-4 py-8 md:px-8 xl:px-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold">Administración</h1>
        <p className="text-sm text-texto-secundario md:text-base">Modera el contenido y mantén la configuración de la plataforma.</p>
      </header>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <Tabs pestanas={PESTANAS} />
      </div>
      <Outlet />
    </main>
  )
}

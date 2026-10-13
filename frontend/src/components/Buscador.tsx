import { Search } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

// Decisión 2026-10-07 (cambia G-40): el buscador va en Desktop (barra, Figma 4:28896) y en Mobile (Feed, Figma 4:29507).
// Filtra en el navegador los eventos del Feed por nombre y descripción; el texto vive en ?q= de /feed.
export function useBusqueda() {
  const [parametros] = useSearchParams()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const texto = parametros.get('q') ?? ''

  function buscar(nuevo: string) {
    const siguientes = new URLSearchParams(pathname === '/feed' ? parametros : undefined)
    if (nuevo) siguientes.set('q', nuevo)
    else siguientes.delete('q')
    const consulta = siguientes.toString()
    navegar(`/feed${consulta ? `?${consulta}` : ''}`, { replace: pathname === '/feed' })
  }
  return { texto, buscar }
}

export function Buscador({ className = '' }: { className?: string }) {
  const { texto, buscar } = useBusqueda()
  return (
    <label className={`flex items-center gap-2 rounded-control px-4 ${className}`}>
      <Search size={20} aria-hidden className="shrink-0 text-metadatos" />
      <input
        type="search"
        value={texto}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar eventos..."
        aria-label="Buscar eventos"
        className="w-full bg-transparent text-sm text-texto placeholder:text-texto-secundario focus:outline-none"
      />
    </label>
  )
}

const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function coincide(evento: { nombre: string; descripcion: string }, texto: string): boolean {
  const buscado = sinTildes(texto.trim())
  return !buscado || sinTildes(`${evento.nombre} ${evento.descripcion}`).includes(buscado)
}

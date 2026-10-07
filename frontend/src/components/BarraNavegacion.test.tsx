import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BarraNavegacion } from './BarraNavegacion'

function renderizar(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <BarraNavegacion iniciales="AB" />
    </MemoryRouter>,
  )
}

describe('BarraNavegacion (Figma 4:30135 · 5:25–5:26)', () => {
  it('muestra la marca, los tres enlaces y las iniciales', () => {
    renderizar('/feed')
    expect(screen.getByText('CampusConecta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute('href', '/feed')
    expect(screen.getByRole('link', { name: 'Mis Eventos' })).toHaveAttribute('href', '/mis-eventos')
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', '/mapa')
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('marca la sección activa', () => {
    renderizar('/mapa')
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  })

  it('decisión 2026-10-07: tiene buscador y no tiene campana', () => {
    renderizar('/feed')
    expect(screen.getByRole('searchbox', { name: 'Buscar eventos' })).toHaveAttribute('placeholder', 'Buscar eventos...')
    expect(screen.queryByRole('button', { name: /notificaciones/i })).not.toBeInTheDocument()
  })
})

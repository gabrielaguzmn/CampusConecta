import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Tabs } from './Tabs'

describe('Tabs (Figma 4:30135 · 5:19–5:20)', () => {
  it('marca como activa la pestaña de la ruta actual', () => {
    render(
      <MemoryRouter initialEntries={['/mis-eventos/historial']}>
        <Tabs
          pestanas={[
            { etiqueta: 'Eventos Activos', a: '/mis-eventos' },
            { etiqueta: 'Historial (Finalizados)', a: '/mis-eventos/historial' },
          ]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Historial (Finalizados)' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Eventos Activos' })).not.toHaveAttribute('aria-current')
  })
})

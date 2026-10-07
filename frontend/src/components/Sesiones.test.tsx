import { render, screen } from '@testing-library/react'
import { fecha } from '../test/datos'
import { Sesiones } from './Sesiones'

describe('Sesiones (Figma 4:30135 · 5:16)', () => {
  it('PUBLICATION-2 · criterio 1: anota el estado de cada fecha con símbolo y texto', () => {
    render(
      <Sesiones
        fechas={[
          fecha(1, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z'),
          fecha(2, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z'),
          fecha(3, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z'),
        ]}
      />,
    )
    expect(screen.getByText('Sesiones')).toBeInTheDocument()
    const lineas = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(lineas).toEqual(['✓ 10 Oct. — Finalizada', '● 17 Oct. — En vivo', '○ 24 Oct. — Próxima'])
  })

  it('no inventa una anotación para fechas canceladas (G-45)', () => {
    render(<Sesiones fechas={[fecha(1, 'cancelada', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z')]} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

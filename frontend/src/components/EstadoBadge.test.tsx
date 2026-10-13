import { render, screen } from '@testing-library/react'
import { EstadoBadge } from './EstadoBadge'

describe('EstadoBadge (Figma 4:30135 · 5:13–5:15, RF-019)', () => {
  it.each([
    ['en_vivo', '●', 'En vivo'],
    ['proxima', '○', 'Próximo'],
    ['cancelada', '×', 'Cancelado'],
  ] as const)('%s lleva símbolo y etiqueta además del color', (estado, simbolo, etiqueta) => {
    const { container } = render(<EstadoBadge estado={estado} />)
    expect(screen.getByText(etiqueta)).toBeInTheDocument()
    expect(container).toHaveTextContent(simbolo)
  })
})

import { render } from '@testing-library/react'
import { PinMapa } from './PinMapa'

describe('PinMapa (Figma 4:30135 · 5:21–5:22)', () => {
  it('usa el color recibido y sin halo por defecto', () => {
    const { container } = render(<PinMapa color="#123456" />)
    expect(container.querySelector('path')).toHaveAttribute('fill', '#123456')
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('el seleccionado añade el halo', () => {
    const { container } = render(<PinMapa color="#123456" seleccionado />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })
})

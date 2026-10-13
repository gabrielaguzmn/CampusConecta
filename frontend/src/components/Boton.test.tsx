import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Boton } from './Boton'

describe('Boton (Figma 4:30135 · 5:2–5:6)', () => {
  it('muestra su etiqueta y responde al clic', async () => {
    const alPulsar = vi.fn()
    render(<Boton onClick={alPulsar}>Iniciar Sesión</Boton>)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(alPulsar).toHaveBeenCalledOnce()
  })

  it('deshabilitado no responde y usa el estilo Disabled', async () => {
    const alPulsar = vi.fn()
    render(<Boton disabled onClick={alPulsar}>Iniciar Sesión</Boton>)
    const boton = screen.getByRole('button')
    await userEvent.click(boton)
    expect(alPulsar).not.toHaveBeenCalled()
    expect(boton.className).toContain('disabled:bg-borde')
  })

  it('no envía formularios por defecto', () => {
    render(<Boton>Iniciar Sesión</Boton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

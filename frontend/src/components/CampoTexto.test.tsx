import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoTexto } from './CampoTexto'

describe('CampoTexto (Figma 4:30135 · 5:7–5:10)', () => {
  it('asocia la etiqueta persistente al campo', () => {
    render(<CampoTexto etiqueta="Correo electrónico" placeholder="tu.nombre@universidad.edu" />)
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('placeholder', 'tu.nombre@universidad.edu')
  })

  it('expresa el error también mediante texto', () => {
    render(<CampoTexto etiqueta="Correo electrónico" error="Introduce un correo válido." />)
    const campo = screen.getByLabelText('Correo electrónico')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription('Introduce un correo válido.')
  })

  it('G-53: el ojo muestra y oculta la contraseña', async () => {
    render(<CampoTexto etiqueta="Contraseña" type="password" />)
    const campo = screen.getByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('los campos que no son contraseña no tienen el ojo', () => {
    render(<CampoTexto etiqueta="Nombre" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('admite la variante multilínea', () => {
    render(<CampoTexto etiqueta="Descripción" multilinea />)
    expect(screen.getByLabelText('Descripción').tagName).toBe('TEXTAREA')
  })
})

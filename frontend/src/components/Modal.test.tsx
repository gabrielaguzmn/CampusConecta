import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal (Figma 4:30135 · 5:23–5:24)', () => {
  it('es un diálogo con título y cierre visible', async () => {
    const alCerrar = vi.fn()
    render(
      <Modal titulo="Gestionar evento" onCerrar={alCerrar}>
        <button>Editar</button>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Gestionar evento' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(alCerrar).toHaveBeenCalledOnce()
  })

  it('se cierra con Escape', async () => {
    const alCerrar = vi.fn()
    render(<Modal titulo="Gestionar evento" onCerrar={alCerrar}>contenido</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(alCerrar).toHaveBeenCalledOnce()
  })

  it('mantiene el foco dentro del diálogo', async () => {
    render(
      <Modal titulo="Gestionar evento" onCerrar={() => {}}>
        <button>Editar</button>
      </Modal>,
    )
    await userEvent.tab() // Cerrar
    await userEvent.tab() // Editar
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })
})

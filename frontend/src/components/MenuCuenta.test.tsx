import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../auth/tokens'
import { json, renderizarApp, simularApi } from '../test/app'

const usuario = { id: 1, nombre: 'Lucía Martínez', email: 'lucia@x.test', es_administrador: false }

function iniciar() {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  simularApi({ 'GET /api/auth/yo/': () => json(usuario), 'GET /api/categorias/': () => json([]), 'GET /api/eventos/': () => json([]) })
}

describe('Menú de la cuenta (G-13, creado el 2026-10-07)', () => {
  it('el avatar abre un menú con el nombre, el correo y "Cerrar sesión"', async () => {
    iniciar()
    renderizarApp('/feed')
    const avatar = await screen.findByRole('button', { name: 'Cuenta de Lucía Martínez' })
    expect(avatar).toHaveTextContent('LM')
    expect(avatar).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(avatar)
    const menu = screen.getByRole('menu', { name: 'Cuenta' })
    expect(menu).toHaveTextContent('Lucía Martínez')
    expect(menu).toHaveTextContent('lucia@x.test')
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('cerrar sesión borra los tokens y lleva a Login', async () => {
    iniciar()
    const router = renderizarApp('/feed')
    await userEvent.click(await screen.findByRole('button', { name: 'Cuenta de Lucía Martínez' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument()
    expect(tokens.access()).toBeNull()
    expect(localStorage.getItem('campusconecta.refresh')).toBeNull()
  })

  it('se cierra con Escape y al tocar fuera', async () => {
    iniciar()
    renderizarApp('/feed')
    const avatar = await screen.findByRole('button', { name: 'Cuenta de Lucía Martínez' })
    await userEvent.click(avatar)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(avatar).toHaveFocus()
    await userEvent.click(avatar)
    await userEvent.click(screen.getByRole('heading', { name: 'Descubre tu campus' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

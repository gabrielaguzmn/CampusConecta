import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'

const usuario = { id: 1, nombre: 'Persona De Prueba', email: 'persona@cualquierdominio.test', es_administrador: false }

describe('ACCESS-1 · DoD: acceso a mapa y feed restringido a sesión iniciada', () => {
  it.each(['/feed', '/mapa', '/mis-eventos'])('sin sesión, %s redirige a /login', async (ruta) => {
    simularApi({})
    const router = renderizarApp(ruta)
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})

describe('ACCESS-1 · criterio 2: inicio de sesión', () => {
  it('con correo y contraseña válidos inicia sesión y accede a las vistas de eventos', async () => {
    const peticiones = simularApi({
      'POST /api/auth/token/': () => json({ access: 'acceso-1', refresh: 'refresco-1' }),
      'GET /api/auth/yo/': () => json(usuario),
    })
    const router = renderizarApp('/feed')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'))
    expect(screen.getByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByText('PD')).toBeInTheDocument()
    expect(await peticiones[0].json()).toEqual({ email: 'persona@cualquierdominio.test', password: 'clave' })
    expect(peticiones[1].headers.get('Authorization')).toBe('Bearer acceso-1')
    // Sesión: access en memoria, refresh en localStorage (02_arquitectura.md §3)
    expect(tokens.access()).toBe('acceso-1')
    expect(localStorage.getItem('campusconecta.refresh')).toBe('refresco-1')
  })

  it('DoD: con credenciales inválidas muestra el mensaje de la API', async () => {
    simularApi({
      'POST /api/auth/token/': () =>
        json({ detail: 'La combinación de credenciales no tiene una cuenta activa', code: 'no_active_account' }, 401),
    })
    const router = renderizarApp('/login')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La combinación de credenciales no tiene una cuenta activa')
    expect(router.state.location.pathname).toBe('/login')
    expect(tokens.access()).toBeNull()
  })

  it('ADMIN-3 · criterio 1: una cuenta suspendida no inicia sesión y ve el mensaje de la API', async () => {
    simularApi({
      'POST /api/auth/token/': () => json({ detail: 'La cuenta está suspendida.', code: 'cuenta_suspendida' }, 401),
    })
    renderizarApp('/login')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta está suspendida.')
  })

  it('valida el formato del correo con el mensaje de Figma y deshabilita el botón', async () => {
    simularApi({})
    renderizarApp('/login')
    const correo = await screen.findByLabelText('Correo electrónico')
    await userEvent.type(correo, 'lucia@')
    await userEvent.tab()
    expect(await screen.findByText('Introduce un correo válido.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeDisabled()
  })

  it('con sesión iniciada, /login lleva al feed', async () => {
    tokens.guardar({ access: 'acceso-1', refresh: 'refresco-1' })
    simularApi({ 'GET /api/auth/yo/': () => json(usuario) })
    const router = renderizarApp('/login')
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'))
  })
})

describe('ACCESS-1 · criterio 1: registro', () => {
  async function completar() {
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Persona De Prueba')
    await userEvent.type(screen.getByLabelText('Correo'), 'persona@cualquierdominio.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura')
    await userEvent.type(screen.getByLabelText('Confirmar Contraseña'), 'clave-segura')
  }

  it('con un correo de cualquier dominio la cuenta queda disponible sin confirmación por enlace', async () => {
    const peticiones = simularApi({
      'POST /api/auth/registro/': () => json({ id: 1, nombre: 'Persona De Prueba', email: 'persona@cualquierdominio.test' }, 201),
    })
    const router = renderizarApp('/registro')
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Registrarse' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await peticiones[0].json()).toEqual({
      nombre: 'Persona De Prueba',
      email: 'persona@cualquierdominio.test',
      password: 'clave-segura',
    })
  })

  it('G-08: si las contraseñas no coinciden no se puede enviar', async () => {
    simularApi({})
    renderizarApp('/registro')
    await completar()
    await userEvent.type(screen.getByLabelText('Confirmar Contraseña'), 'x')
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeDisabled()
  })

  it('muestra en su campo los errores que devuelve la API', async () => {
    simularApi({ 'POST /api/auth/registro/': () => json({ email: ['Ya existe una cuenta con este correo.'] }, 400) })
    renderizarApp('/registro')
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    expect(await screen.findByLabelText('Correo')).toHaveAccessibleDescription('Ya existe una cuenta con este correo.')
  })
})

describe('ACCESS-1 · criterio 3: recuperación de contraseña', () => {
  it('solicita a la API el envío del enlace al correo indicado', async () => {
    const peticiones = simularApi({ 'POST /api/auth/recuperacion/': () => new Response(null, { status: 204 }) })
    renderizarApp('/recuperar')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    await waitFor(() => expect(peticiones).toHaveLength(1))
    expect(await peticiones[0].json()).toEqual({ email: 'persona@cualquierdominio.test' })
  })

  it('enlaza de vuelta a Login', async () => {
    simularApi({})
    renderizarApp('/recuperar')
    expect(await screen.findByRole('link', { name: 'Volver a Login' })).toHaveAttribute('href', '/login')
  })
})

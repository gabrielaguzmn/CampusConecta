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
      'GET /api/categorias/': () => json([]),
      'GET /api/eventos/': () => json([]),
    })
    const router = renderizarApp('/feed')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'))
    expect(await screen.findByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByText('PD')).toBeInTheDocument()
    expect(await peticiones[0].json()).toEqual({ email: 'persona@cualquierdominio.test', password: 'clave' })
    const yo = peticiones.find((p) => p.url.endsWith('/api/auth/yo/'))!
    expect(yo.headers.get('Authorization')).toBe('Bearer acceso-1')
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
    expect(await screen.findByRole('status')).toHaveTextContent('Enlace de recuperación enviado')
  })

  it('si el correo no está registrado muestra solo un toast de error', async () => {
    simularApi({
      'POST /api/auth/recuperacion/': () => json({ email: ['La cuenta no está registrada.'] }, 400),
    })
    renderizarApp('/recuperar')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'nadie@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta no está registrada.')
    expect(screen.getAllByText('La cuenta no está registrada.')).toHaveLength(1)
  })

  it('traduce el código de cuenta suspendida aunque la API no incluya el texto', async () => {
    simularApi({
      'POST /api/auth/recuperacion/': () => json({ codes: { email: 'cuenta_suspendida' } }, 400),
    })
    renderizarApp('/recuperar')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'suspendida@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No puedes recuperar la contraseña mientras esté suspendida.')
  })

  it('si la cuenta está suspendida muestra un toast y no ofrece recuperación', async () => {
    simularApi({
      'POST /api/auth/recuperacion/': () =>
        json({ email: ['La cuenta está suspendida. No puedes recuperar la contraseña mientras esté suspendida.'] }, 400),
    })
    renderizarApp('/recuperar')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'suspendida@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta está suspendida. No puedes recuperar la contraseña mientras esté suspendida.')
    expect(screen.getAllByText('La cuenta está suspendida. No puedes recuperar la contraseña mientras esté suspendida.')).toHaveLength(1)
  })

  it('si la API rechaza el correo, muestra el error solo en un toast', async () => {
    simularApi({
      'POST /api/auth/recuperacion/': () =>
        json({ email: ['Introduzca una dirección de correo electrónico válida.'], codes: { email: ['invalid'] } }, 400),
    })
    renderizarApp('/recuperar')
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'persona@cualquierdominio.test')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Introduzca una dirección de correo electrónico válida.')
    expect(screen.getAllByText('Introduzca una dirección de correo electrónico válida.')).toHaveLength(1)
  })

  it('enlaza de vuelta a Login', async () => {
    simularApi({})
    renderizarApp('/recuperar')
    expect(await screen.findByRole('link', { name: 'Volver a Login' })).toHaveAttribute('href', '/login')
  })
})

describe('G-49: nueva contraseña desde el enlace del correo (pantalla creada el 2026-10-07)', () => {
  async function completar(password = 'nueva-clave', confirmar = 'nueva-clave') {
    await userEvent.type(await screen.findByLabelText('Nueva contraseña'), password)
    await userEvent.type(screen.getByLabelText('Confirmar Contraseña'), confirmar)
  }

  it('envía uid, token y la nueva contraseña, y luego ofrece iniciar sesión', async () => {
    const peticiones = simularApi({ 'POST /api/auth/recuperacion/confirmar/': () => new Response(null, { status: 204 }) })
    renderizarApp('/recuperar/confirmar?uid=MQ&token=abc-123')
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument()
    expect(await peticiones[0].json()).toEqual({ uid: 'MQ', token: 'abc-123', password: 'nueva-clave' })
    expect(screen.getByRole('link', { name: 'Iniciar Sesión' })).toHaveAttribute('href', '/login')
  })

  it('si el enlace caducó muestra el mensaje de la API y permite pedir otro', async () => {
    simularApi({
      'POST /api/auth/recuperacion/confirmar/': () => json({ non_field_errors: ['El enlace no es válido o ha caducado.'] }, 400),
    })
    renderizarApp('/recuperar/confirmar?uid=MQ&token=viejo')
    await completar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.')
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute('href', '/recuperar')
  })

  it('sin uid y token, o si las contraseñas no coinciden, no se puede enviar', async () => {
    simularApi({})
    renderizarApp('/recuperar/confirmar')
    await completar()
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled()
  })
})

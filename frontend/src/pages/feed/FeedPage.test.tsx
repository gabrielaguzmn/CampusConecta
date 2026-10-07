import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'
import { evento, fecha } from '../../test/datos'

const usuario = { id: 1, nombre: 'Persona De Prueba', email: 'p@x.test', es_administrador: false }
const categorias = [
  { id: 1, nombre: 'Ventas', color: '#952D2D' },
  { id: 5, nombre: 'Deportes y recreación', color: '#E20000' },
]
const venta = evento({ id: 10, nombre: 'Evento A', categoria: categorias[0] })
const deporte = evento({
  id: 11,
  nombre: 'Evento B',
  categoria: categorias[1],
  fechas: [fecha(2, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z')],
})

function iniciarConFeed(responder: (url: URL) => unknown) {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  return simularApi({
    'GET /api/auth/yo/': () => json(usuario),
    'GET /api/categorias/': () => json(categorias),
    'GET /api/eventos/': (peticion) => json(responder(new URL(peticion.url))),
  })
}

const consultasFeed = (peticiones: Request[]) =>
  peticiones.filter((p) => new URL(p.url).pathname === '/api/eventos/').map((p) => new URL(p.url).search)

describe('DISPLAY-1: exploración de eventos mediante feed', () => {
  it('criterio 1 y 2: con sesión iniciada lista en scroll los eventos vigentes que entrega la API', async () => {
    iniciarConFeed(() => [venta, deporte])
    renderizarApp('/feed')
    expect(await screen.findByRole('heading', { name: 'Descubre tu campus' })).toBeInTheDocument()
    expect(await screen.findByText('2 eventos en tu campus')).toBeInTheDocument()
    const lista = screen.getAllByRole('list').at(-1)!
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page')
  })

  it('criterio 3: un evento que deja de ser vigente desaparece en la siguiente consulta', async () => {
    let respuesta = [venta, deporte]
    iniciarConFeed(() => respuesta)
    renderizarApp('/feed')
    expect(await screen.findByText('Evento B')).toBeInTheDocument()
    respuesta = [venta]
    await userEvent.click(screen.getByRole('button', { name: 'Ventas' })) // fuerza una nueva consulta
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => expect(screen.queryByText('Evento B')).not.toBeInTheDocument())
  })
})

describe('DISPLAY-2: filtrado de eventos', () => {
  it('muestra un chip por categoría con el nombre del catálogo (G-47)', async () => {
    iniciarConFeed(() => [])
    renderizarApp('/feed')
    expect(await screen.findByRole('button', { name: 'Deportes y recreación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('criterio 1: al seleccionar una categoría solo se muestran sus eventos', async () => {
    const peticiones = iniciarConFeed((url) => (url.searchParams.get('categoria') === '5' ? [deporte] : [venta, deporte]))
    renderizarApp('/feed')
    await userEvent.click(await screen.findByRole('button', { name: 'Deportes y recreación' }))
    await waitFor(() => expect(screen.queryByText('Evento A')).not.toBeInTheDocument())
    expect(screen.getByText('Evento B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deportes y recreación' })).toHaveAttribute('aria-pressed', 'true')
    expect(consultasFeed(peticiones)).toContain('?categoria=5')
  })

  it('G-47: solo una categoría a la vez', async () => {
    iniciarConFeed(() => [])
    renderizarApp('/feed')
    await userEvent.click(await screen.findByRole('button', { name: 'Ventas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deportes y recreación' }))
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Deportes y recreación' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('criterio 2: G-19 eliminó el filtro por fecha; no hay control de fecha', async () => {
    iniciarConFeed(() => [])
    renderizarApp('/feed')
    await screen.findByRole('button', { name: 'Todos' })
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument()
  })

  it('criterio 3: filtra por estado y permite combinarlo con la categoría', async () => {
    const peticiones = iniciarConFeed(() => [deporte])
    renderizarApp('/feed')
    await userEvent.click(await screen.findByRole('button', { name: 'En vivo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deportes y recreación' }))
    await waitFor(() => expect(consultasFeed(peticiones)).toContain('?categoria=5&estado=en_vivo'))
  })

  it('DoD: el filtro se retira con "Todos" y volviendo a pulsar el estado activo', async () => {
    const peticiones = iniciarConFeed(() => [])
    renderizarApp('/feed?categoria=5&estado=proxima')
    await userEvent.click(await screen.findByRole('button', { name: 'Próximos' }))
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => expect(consultasFeed(peticiones).at(-1)).toBe(''))
    expect(screen.getByRole('button', { name: 'Próximos' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('DoD: el estado vacío se entiende con el resumen de Figma', async () => {
    iniciarConFeed(() => [])
    renderizarApp('/feed')
    expect(await screen.findByText('0 eventos en tu campus')).toBeInTheDocument()
  })
})

describe('Buscador (decisión 2026-10-07, cambia G-40)', () => {
  it('filtra por nombre o descripción sin distinguir tildes ni mayúsculas', async () => {
    iniciarConFeed(() => [
      evento({ id: 1, nombre: 'Taller de cerámica', descripcion: 'Barro' }),
      evento({ id: 2, nombre: 'Feria', descripcion: 'Proyectos de estudiantes' }),
    ])
    renderizarApp('/feed')
    const [buscador] = await screen.findAllByRole('searchbox', { name: 'Buscar eventos' })
    await userEvent.type(buscador, 'CERAMICA')
    expect(screen.getByText('Taller de cerámica')).toBeInTheDocument()
    expect(screen.queryByText('Feria')).not.toBeInTheDocument()
    expect(screen.getByText('1 evento en tu campus')).toBeInTheDocument()
    await userEvent.clear(buscador)
    await userEvent.type(buscador, 'estudiantes')
    expect(screen.getByText('Feria')).toBeInTheDocument()
  })

  it('desde otra sección lleva al Feed con la búsqueda', async () => {
    iniciarConFeed(() => [])
    const router = renderizarApp('/mapa')
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar eventos' }), 'v')
    await waitFor(() => expect(router.state.location.pathname).toBe('/feed'))
    expect(router.state.location.search).toBe('?q=v')
  })
})

describe('G-58 y G-51 en el Feed', () => {
  it('muestra el mes actual junto al resumen', async () => {
    iniciarConFeed(() => [])
    renderizarApp('/feed')
    await screen.findByText('0 eventos en tu campus')
    expect(screen.getByText(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) \d{4}$/)).toBeInTheDocument()
  })

  it('mientras carga muestra tarjetas grises', async () => {
    tokens.guardar({ access: 'acceso', refresh: 'refresco' })
    simularApi({
      'GET /api/auth/yo/': () => json(usuario),
      'GET /api/categorias/': () => json(categorias),
      'GET /api/eventos/': () => new Promise<Response>(() => {}),
    })
    renderizarApp('/feed')
    expect(await screen.findByRole('list', { name: 'Cargando eventos' })).toHaveAttribute('aria-busy', 'true')
  })

  it('si la API falla avisa y permite reintentar', async () => {
    let falla = true
    iniciarConFeed(() => (falla ? undefined : [venta]))
    tokens.guardar({ access: 'acceso', refresh: 'refresco' })
    simularApi({
      'GET /api/auth/yo/': () => json(usuario),
      'GET /api/categorias/': () => json(categorias),
      'GET /api/eventos/': () => (falla ? json({ detail: 'error' }, 500) : json([venta])),
    })
    renderizarApp('/feed')
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los eventos. Intenta de nuevo.')
    falla = false
    await userEvent.click(screen.getByRole('button', { name: 'Intenta de nuevo.' }))
    expect(await screen.findByText('Evento A')).toBeInTheDocument()
  })
})

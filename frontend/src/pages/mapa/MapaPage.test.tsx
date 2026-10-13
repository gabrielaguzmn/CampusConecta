import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'
import { fecha } from '../../test/datos'
import type { PropsMapaCampus } from './MapaCampus'

// Doble del mapa que integrará otro miembro del equipo: un botón por evento hace de pin.
const recibido: { props?: PropsMapaCampus } = {}
vi.mock('./MapaCampus', () => ({
  MapaCampus: (props: PropsMapaCampus) => {
    recibido.props = props
    return (
      <div>
        {props.ubicaciones.flatMap((u) =>
          u.eventos.map((e) => (
            <button key={e.id} onClick={() => props.onSeleccionar(e.id)} aria-pressed={props.seleccionado === e.id}>
              pin {e.nombre}
            </button>
          )),
        )}
      </div>
    )
  },
}))

const usuario = { id: 1, nombre: 'Persona De Prueba', email: 'p@x.test', es_administrador: false }
const categoria = { id: 2, nombre: 'Categoría de prueba', color: '#123456' }
const multifecha = {
  id: 1,
  nombre: 'Evento A',
  categoria,
  detalle_ubicacion: 'Detalle de prueba',
  fechas: [
    fecha(1, 'finalizada', '2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z'),
    fecha(2, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z'),
  ],
}
const otro = { id: 2, nombre: 'Evento B', categoria, fechas: [fecha(3, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z')] }

function iniciarConMapa(responder: () => unknown) {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  simularApi({
    'GET /api/auth/yo/': () => json(usuario),
    'GET /api/categorias/': () => json([categoria]),
    'GET /api/mapa/': () => json(responder()),
  })
}

describe('INTERACTIVITY-1: mapa interactivo del campus', () => {
  it('criterio 1: con sesión iniciada entrega al mapa los eventos vigentes por ubicación del catálogo', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'Ubicación de prueba' }, eventos: [multifecha] }])
    renderizarApp('/mapa')
    expect(await screen.findByRole('heading', { name: 'Explora el campus' })).toBeInTheDocument()
    await screen.findByRole('button', { name: 'pin Evento A' })
    expect(recibido.props?.ubicaciones[0].ubicacion.nombre).toBe('Ubicación de prueba')
  })

  it('criterio 2: varios eventos en una misma ubicación llegan todos al mapa', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'Ubicación de prueba' }, eventos: [multifecha, otro] }])
    renderizarApp('/mapa')
    expect(await screen.findByRole('button', { name: 'pin Evento A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pin Evento B' })).toBeInTheDocument()
  })

  it('criterio 3: un evento que deja de ser vigente no se muestra en la siguiente consulta', async () => {
    let respuesta = [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [multifecha, otro] }]
    iniciarConMapa(() => respuesta)
    renderizarApp('/mapa')
    await screen.findByRole('button', { name: 'pin Evento B' })
    respuesta = [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [multifecha] }]
    await userEvent.click(screen.getByRole('link', { name: 'Feed' }))
    await userEvent.click(screen.getByRole('link', { name: 'Mapa' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'pin Evento B' })).not.toBeInTheDocument())
  })

  it('la leyenda muestra cada categoría con su nombre y el color de la API', async () => {
    iniciarConMapa(() => [])
    renderizarApp('/mapa')
    const leyenda = await screen.findByRole('heading', { name: 'Categorías' })
    const item = await within(leyenda.parentElement!).findByText('Categoría de prueba')
    expect(item.querySelector('span')).toHaveStyle({ backgroundColor: '#123456' })
  })
})

describe('INTERACTIVITY-2: detalle de evento desde un pin', () => {
  it('criterio 1: al seleccionar un pin se despliega la información básica del evento', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [multifecha, otro] }])
    renderizarApp('/mapa')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'pin Evento A' }))
    const tarjeta = screen.getByRole('article', { name: 'Evento A' })
    expect(within(tarjeta).getByText('Categoría de prueba')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Detalle de prueba')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pin Evento A' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('criterio 3: con varias fechas distingue cada una con su día, horario y estado', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [multifecha] }])
    renderizarApp('/mapa')
    await userEvent.click(await screen.findByRole('button', { name: 'pin Evento A' }))
    const lineas = within(screen.getByRole('article')).getAllByRole('listitem').map((li) => li.textContent)
    expect(lineas).toEqual(['✓ 10 Oct. · 16:00–18:00 — Finalizada', '● 17 Oct. · 16:00–18:00 — En vivo'])
  })

  it('criterio 2: "Ver más" lleva al detalle completo del evento', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [otro] }])
    const router = renderizarApp('/mapa')
    await userEvent.click(await screen.findByRole('button', { name: 'pin Evento B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(router.state.location.pathname).toBe('/eventos/2')
  })

  it('INTERACTIVITY-3 · criterio 2: sin detalle de ubicación no se inventa uno', async () => {
    iniciarConMapa(() => [{ ubicacion: { id: 7, nombre: 'U' }, eventos: [otro] }])
    renderizarApp('/mapa')
    await userEvent.click(await screen.findByRole('button', { name: 'pin Evento B' }))
    expect(within(screen.getByRole('article')).queryByText(/Detalle/)).not.toBeInTheDocument()
  })
})

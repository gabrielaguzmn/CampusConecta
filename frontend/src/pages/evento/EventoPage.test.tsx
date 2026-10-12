import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokens } from '../../auth/tokens'
import { json, renderizarApp, simularApi } from '../../test/app'
import { evento, fecha } from '../../test/datos'

const usuario = { id: 1, nombre: 'Persona De Prueba', email: 'p@x.test', es_administrador: false }
const normas = [
  { id: 1, nombre: 'Ámbito de los eventos' },
  { id: 3, nombre: 'Respeto y convivencia' },
]

function iniciar(respuestas: Parameters<typeof simularApi>[0]) {
  tokens.guardar({ access: 'acceso', refresh: 'refresco' })
  return simularApi({ 'GET /api/auth/yo/': () => json(usuario), 'GET /api/normas/': () => json(normas), ...respuestas })
}

const completo = evento({
  id: 5,
  detalle_ubicacion: 'Detalle de prueba',
  cupo: 30,
  contacto: 'Contacto de prueba',
  enlace_externo: 'https://example.test/evento',
  fechas: [
    fecha(1, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z'),
    fecha(2, 'proxima', '2026-10-24T22:00:00Z', '2026-10-25T00:00:00Z'),
  ],
})

describe('Detalle del evento (pantalla creada el 2026-10-07, G-12)', () => {
  it('INTERACTIVITY-2 · criterio 2: muestra la información completa del evento', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(completo) })
    renderizarApp('/eventos/5')
    expect(await screen.findByRole('heading', { level: 1, name: 'Evento de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Descripción de prueba')).toBeInTheDocument()
    expect(screen.getByText('Ubicación de prueba')).toBeInTheDocument()
    expect(screen.getByText('Responsable de prueba')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('Contacto de prueba')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://example.test/evento' })).toHaveAttribute('target', '_blank')
  })

  it('INTERACTIVITY-2 · criterio 3: distingue cada fecha con su horario y estado', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(completo) })
    renderizarApp('/eventos/5')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '● 17 Oct. · 16:00–18:00 — En vivo',
      '○ 24 Oct. · 17:00–19:00 — Próxima',
    ])
  })

  it('INTERACTIVITY-3 · criterio 1: muestra el detalle de ubicación indicado por el organizador', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(completo) })
    renderizarApp('/eventos/5')
    expect(await screen.findByText('Detalle de prueba')).toBeInTheDocument()
  })

  it('INTERACTIVITY-3 · criterio 2: sin detalle de ubicación no se inventa uno', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(evento({ id: 5 })) })
    renderizarApp('/eventos/5')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Detalle de ubicación')).not.toBeInTheDocument()
  })

  it('G-38: si el evento ya no está disponible lo indica', async () => {
    iniciar({ 'GET /api/eventos/9/': () => json({ detail: 'No encontrado.' }, 404) })
    renderizarApp('/eventos/9')
    expect(await screen.findByText(/Este evento ya no está disponible/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al Feed' })).toHaveAttribute('href', '/feed')
  })
})

describe('DISPLAY-3: reporte de eventos inapropiados', () => {
  async function abrirReporte(peticionReporte: () => Response) {
    const peticiones = iniciar({ 'GET /api/eventos/5/': () => json(completo), 'POST /api/eventos/5/reportes/': peticionReporte })
    renderizarApp('/eventos/5')
    await userEvent.click(await screen.findByRole('button', { name: 'Reportar evento' }))
    return { peticiones, dialogo: screen.getByRole('dialog', { name: 'Reportar evento' }) }
  }

  it('criterio 1: la causa es obligatoria y el reporte se envía asociado al evento', async () => {
    const { peticiones, dialogo } = await abrirReporte(() => json({ detail: 'Tu reporte fue enviado y será revisado.' }, 201))
    expect(within(dialogo).getByRole('button', { name: 'Enviar reporte' })).toBeDisabled()
    await within(dialogo).findByRole('option', { name: '3. Respeto y convivencia' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Causa'), '3')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar reporte' }))
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/api/eventos/5/reportes/'))).toBe(true))
    const reporte = peticiones.find((p) => p.url.endsWith('/api/eventos/5/reportes/'))!
    expect(await reporte.json()).toEqual({ causa: 3, detalles: '' })
  })

  it('criterio 2 y 3: incluye los detalles opcionales y confirma con el mensaje de la API, sin seguimiento', async () => {
    const { peticiones, dialogo } = await abrirReporte(() => json({ detail: 'Tu reporte fue enviado y será revisado.' }, 201))
    await within(dialogo).findByRole('option', { name: '1. Ámbito de los eventos' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Causa'), '1')
    await userEvent.type(within(dialogo).getByLabelText('Detalles (opcional)'), 'Es fuera del campus')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar reporte' }))
    expect(await screen.findByRole('dialog', { name: 'Reporte enviado' })).toHaveTextContent('Tu reporte fue enviado y será revisado.')
    const reporte = peticiones.find((p) => p.url.endsWith('/api/eventos/5/reportes/'))!
    expect(await reporte.json()).toEqual({ causa: 1, detalles: 'Es fuera del campus' })
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Imagen completa (decisión 2026-10-11)', () => {
  it('al pulsar la portada se abre la imagen completa y se puede cerrar', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(completo) })
    renderizarApp('/eventos/5')
    await userEvent.click(await screen.findByRole('button', { name: 'Ver imagen completa' }))
    const dialogo = screen.getByRole('dialog')
    const imagen = within(dialogo).getByRole('img', { name: 'Imagen de Evento de prueba' })
    expect(imagen).toHaveAttribute('src', 'https://example.test/imagen.jpg')
    expect(imagen).toHaveClass('object-contain')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin imagen no ofrece verla completa', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json({ ...completo, imagen: null }) })
    renderizarApp('/eventos/5')
    await screen.findByRole('heading', { name: 'Evento de prueba' })
    expect(screen.queryByRole('button', { name: 'Ver imagen completa' })).not.toBeInTheDocument()
  })

  it('si la imagen no carga, desaparece el botón y queda el color de la categoría', async () => {
    iniciar({ 'GET /api/eventos/5/': () => json(completo) })
    renderizarApp('/eventos/5')
    const boton = await screen.findByRole('button', { name: 'Ver imagen completa' })
    fireEvent.error(boton.querySelector('img')!)
    expect(screen.queryByRole('button', { name: 'Ver imagen completa' })).not.toBeInTheDocument()
  })
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { tokens } from '../../auth/tokens'
import { evento } from '../../test/datos'
import { json, renderizarApp, simularApi } from '../../test/app'
import { instalarAPIsDeVoz, emitirTranscripcion, WebSocketFalso } from '../../test/vozFalso'

vi.stubEnv('TZ', 'America/Bogota')
afterAll(() => vi.unstubAllEnvs())

const usuario = { id: 1, nombre: 'Persona de prueba', email: 'voz@example.test', es_administrador: false }
const categorias = [{ id: 2, nombre: 'Talleres', color: '#123456' }]
const ubicaciones = [{ id: 7, nombre: 'Edificio B13' }]
const normas = [{ id: 3, nombre: 'Respeto y convivencia' }]
const eventoExistente = evento({
  id: 20,
  nombre: 'Evento existente',
  categoria: { id: 2, nombre: 'Talleres' },
  ubicacion: { id: 7, nombre: 'Edificio B13' },
})

function iniciar(respuestas: Record<string, (peticion: Request) => Response | Promise<Response>> = {}) {
  tokens.guardar({ access: 'sesion-de-prueba', refresh: 'refresco-de-prueba' })
  return simularApi({
    'GET /api/auth/yo/': () => json(usuario),
    'GET /api/categorias/': () => json(categorias),
    'GET /api/ubicaciones/': () => json(ubicaciones),
    'GET /api/normas/': () => json(normas),
    'GET /api/mis-eventos/': () => json([eventoExistente]),
    ...respuestas,
  })
}

async function abrirCreacion() {
  await userEvent.click(await screen.findByRole('button', { name: 'Crear evento' }))
  return within(screen.getByRole('dialog', { name: 'Crear evento' }))
}

async function iniciarAsistente(dentro: ReturnType<typeof within>, apiVoz: ReturnType<typeof instalarAPIsDeVoz>) {
  await userEvent.click(dentro.getByRole('button', { name: 'Activar asistente de voz' }))
  await userEvent.click(dentro.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(WebSocketFalso.instancias).toHaveLength(1))
  WebSocketFalso.instancias[0].abrir()
  await dentro.findByText('Estado: escuchando')
  return apiVoz
}

describe('VOICE: integración del asistente con el formulario de eventos', () => {
  afterEach(() => {
    WebSocketFalso.instancias = []
    vi.unstubAllGlobals()
  })

  it('VOICE-2 a VOICE-6: rellena los campos y las fechas, deja corregir y solo crea al pulsar el botón', async () => {
    const apiVoz = instalarAPIsDeVoz()
    const peticiones = iniciar({
      'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }),
      'POST /api/eventos/': () => json({ ...eventoExistente, id: 99 }, 201),
    })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await iniciarAsistente(dentro, apiVoz)

    await emitirTranscripcion('Nombre: Feria de emprendimiento')
    await emitirTranscripcion('Descripción: Actividad para estudiantes')
    await emitirTranscripcion('Categoría: Talleres')
    await emitirTranscripcion('Ubicación: Edificio B 13')
    await emitirTranscripcion('Organiza Club de ciencia')
    await emitirTranscripcion('El 16 de diciembre de 2026 a las 3 de la tarde hasta las 5 de la tarde')

    const nombre = dentro.getByLabelText('Nombre del evento')
    await waitFor(() => expect(nombre).toHaveValue('Feria de emprendimiento'))
    expect(dentro.getByLabelText('Descripción')).toHaveValue('Actividad para estudiantes')
    expect(dentro.getByLabelText('Responsable')).toHaveValue('Club de ciencia')
    expect(dentro.getByLabelText('Categoría')).toHaveValue('2')
    expect(dentro.getByLabelText('Ubicación *')).toHaveValue('7')
    expect(dentro.getAllByLabelText('Inicio')[0]).toHaveValue('2026-12-16T15:00')
    expect(dentro.getAllByLabelText('Fin')[0]).toHaveValue('2026-12-16T17:00')
    expect(nombre.parentElement?.parentElement?.className).toContain('ring-2')
    expect(peticiones.some((p) => p.method === 'POST' && new URL(p.url).pathname === '/api/eventos/')).toBe(false)

    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Feria corregida')
    expect(nombre).toHaveValue('Feria corregida')
    expect(nombre.parentElement?.parentElement?.className).not.toContain('ring-2')

    await userEvent.click(dentro.getByRole('button', { name: 'Crear evento' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Crear evento' })).not.toBeInTheDocument())
    const peticionCrear = peticiones.find((p) => p.method === 'POST' && new URL(p.url).pathname === '/api/eventos/')
    expect(peticionCrear).toBeDefined()
    await expect(peticionCrear!.json()).resolves.toMatchObject({
      nombre: 'Feria corregida',
      descripcion: 'Actividad para estudiantes',
      categoria: 2,
      ubicacion: 7,
      responsable: 'Club de ciencia',
      fechas: [{ inicio: '2026-12-16T15:00:00-05:00', fin: '2026-12-16T17:00:00-05:00' }],
    })
  })

  it('VOICE: el asistente no aparece al editar un evento', async () => {
    iniciar()
    renderizarApp('/mis-eventos')
    await userEvent.click(await screen.findByRole('button', { name: 'Gestionar Evento existente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('dialog', { name: 'Editar evento' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Asistente de voz' })).not.toBeInTheDocument()
  })

  it('VOICE-5: la API rechaza una fecha dictada que se solapa con una ya agregada', async () => {
    const apiVoz = instalarAPIsDeVoz()
    const peticiones = iniciar({
      'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }),
      'POST /api/eventos/': () => json({ fechas: ['Dos fechas del mismo evento no pueden solaparse.'] }, 400),
    })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await userEvent.type(dentro.getByLabelText('Nombre del evento'), 'Feria de prueba')
    await userEvent.selectOptions(dentro.getByLabelText('Categoría'), '2')
    await userEvent.selectOptions(dentro.getByLabelText('Ubicación *'), '7')
    await userEvent.type(dentro.getByLabelText('Responsable'), 'Club de ciencia')
    await userEvent.type(dentro.getAllByLabelText('Inicio')[0], '2027-12-16T15:00')
    await userEvent.type(dentro.getAllByLabelText('Fin')[0], '2027-12-16T17:00')
    await iniciarAsistente(dentro, apiVoz)
    await emitirTranscripcion('El 16 de diciembre de 2027 a las 3 pm hasta las 5 pm')
    await waitFor(() => expect(dentro.getAllByLabelText('Inicio')).toHaveLength(2))
    expect(dentro.getAllByLabelText('Inicio')[1]).toHaveValue('2027-12-16T15:00')
    expect(dentro.getAllByLabelText('Fin')[1]).toHaveValue('2027-12-16T17:00')
    await userEvent.click(dentro.getByRole('button', { name: 'Crear evento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Dos fechas del mismo evento no pueden solaparse.')
    const peticionCrear = peticiones.find((peticion) => peticion.method === 'POST' && new URL(peticion.url).pathname === '/api/eventos/')
    expect(peticionCrear).toBeDefined()
    const cuerpo = await peticionCrear!.json() as { fechas: { inicio: string; fin: string }[] }
    expect(cuerpo.fechas).toEqual([
      { inicio: '2027-12-16T15:00:00-05:00', fin: '2027-12-16T17:00:00-05:00' },
      { inicio: '2027-12-16T15:00:00-05:00', fin: '2027-12-16T17:00:00-05:00' },
    ])
  })

  it('VOICE-6/RF-040: ninguna frase publica sin clic explícito en Crear evento', async () => {
    const apiVoz = instalarAPIsDeVoz()
    const peticiones = iniciar({
      'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }),
      'POST /api/eventos/': () => json({ ...eventoExistente, id: 99 }, 201),
    })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await iniciarAsistente(dentro, apiVoz)
    await emitirTranscripcion('Nombre: Feria')
    await emitirTranscripcion('Categoría: Talleres')
    await emitirTranscripcion('Ubicación: Edificio B13')
    await emitirTranscripcion('Responsable: Club')
    await emitirTranscripcion('El 16 de diciembre de 2026 a las 3 pm hasta las 5 pm')
    await emitirTranscripcion('Crear evento')
    await waitFor(() => expect(dentro.getByLabelText('Nombre del evento')).toHaveValue('Feria'))
    expect(peticiones.filter((p) => p.method === 'POST' && new URL(p.url).pathname === '/api/eventos/')).toHaveLength(0)
  })

  it('RNF-008: la transcripción no se envía por la API ni queda en almacenamiento web', async () => {
    const apiVoz = instalarAPIsDeVoz()
    const textoPrivado = 'Nombre: Transcripción privada de prueba'
    const peticiones = iniciar({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await iniciarAsistente(dentro, apiVoz)
    await emitirTranscripcion(textoPrivado)
    const transcripcion = await waitFor(() => {
      const panel = within(screen.getByRole('region', { name: 'Asistente de voz' }))
        .getAllByRole('status')
        .find((status) => status.textContent?.includes('Lo reconocido:'))
      expect(panel).toBeDefined()
      return panel
    })
    expect(transcripcion).toHaveTextContent(textoPrivado)
    expect(peticiones.every((p) => !p.url.includes(encodeURIComponent(textoPrivado)))).toBe(true)
    for (const peticion of peticiones) {
      if (peticion.headers.get('Content-Type')?.includes('json')) {
        expect(await peticion.clone().text()).not.toContain(textoPrivado)
      }
    }
    expect(localStorage.getItem('campusconecta.refresh')).not.toContain(textoPrivado)
    expect(sessionStorage.length).toBe(0)
  })

  it('RNF-010: el panel trata HTML como texto y los campos conservan la cadena literal', async () => {
    const apiVoz = instalarAPIsDeVoz()
    const peticiones = iniciar({
      'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }),
      'POST /api/eventos/': () => json({ ...eventoExistente, id: 99 }, 201),
    })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await iniciarAsistente(dentro, apiVoz)
    const maliciosoComoTexto = '<script>alert("prueba")</script> & "'
    await emitirTranscripcion(`Nombre: ${maliciosoComoTexto}`)
    const transcripcion = await waitFor(() => {
      const panel = within(screen.getByRole('region', { name: 'Asistente de voz' }))
        .getAllByRole('status')
        .find((status) => status.textContent?.includes('Lo reconocido:'))
      expect(panel).toBeDefined()
      return panel
    })
    expect(transcripcion).toHaveTextContent(maliciosoComoTexto)
    expect(document.querySelector('script:not([src])')).toBeNull()
    const nombre = dentro.getByLabelText('Nombre del evento')
    await waitFor(() => expect(nombre).toHaveValue(maliciosoComoTexto))
    await userEvent.type(dentro.getByLabelText('Responsable'), 'Club')
    await userEvent.selectOptions(dentro.getByLabelText('Categoría'), '2')
    await userEvent.selectOptions(dentro.getByLabelText('Ubicación *'), '7')
    await userEvent.type(dentro.getAllByLabelText('Inicio')[0], '2026-12-16T15:00')
    await userEvent.type(dentro.getAllByLabelText('Fin')[0], '2026-12-16T17:00')
    await userEvent.click(dentro.getByRole('button', { name: 'Crear evento' }))
    const crear = await waitFor(() => {
      const request = peticiones.find((p) => p.method === 'POST' && new URL(p.url).pathname === '/api/eventos/')
      expect(request).toBeDefined()
      return request!
    })
    await expect(crear.json()).resolves.toMatchObject({ nombre: maliciosoComoTexto })
  })

  it('VOICE-7 DoD: cerrar el formulario desmonta el asistente y libera recursos', async () => {
    const apiVoz = instalarAPIsDeVoz()
    iniciar({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderizarApp('/mis-eventos')
    const dentro = await abrirCreacion()
    await iniciarAsistente(dentro, apiVoz)
    await userEvent.click(dentro.getByRole('button', { name: 'Cerrar' }))
    expect(apiVoz.pista.stop).toHaveBeenCalled()
    expect(WebSocketFalso.instancias[0].close).toHaveBeenCalled()
    expect(apiVoz.contexto.close).toHaveBeenCalled()
  })
})

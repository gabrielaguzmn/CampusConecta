import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AsistenteVoz } from './AsistenteVoz'
import { json, simularApi } from '../test/app'
import { instalarAPIsDeVoz, emitirTranscripcion, WebSocketFalso } from '../test/vozFalso'

const ubicaciones = [
  { id: 7, nombre: 'Biblioteca Central' },
  { id: 8, nombre: 'Biblioteca del Campus' },
]
const categorias = [{ id: 2, nombre: 'Talleres' }]

function renderAsistente(override: Partial<Parameters<typeof AsistenteVoz>[0]> = {}) {
  const setValue = vi.fn()
  const appendFecha = vi.fn()
  const onFieldsVoice = vi.fn()
  render(
    <AsistenteVoz
      categorias={categorias}
      ubicaciones={ubicaciones}
      setValue={setValue}
      appendFecha={appendFecha}
      onFieldsVoice={onFieldsVoice}
      {...override}
    />,
  )
  return { setValue, appendFecha, onFieldsVoice }
}

async function continuar() {
  await userEvent.click(screen.getByRole('button', { name: 'Activar asistente de voz' }))
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

async function conectar() {
  await continuar()
  await screen.findByText('Estado: conectando')
  await waitFor(() => expect(WebSocketFalso.instancias).toHaveLength(1))
  act(() => WebSocketFalso.instancias[0].abrir())
}

describe('VOICE-7: asistente de voz en navegador', () => {
  afterEach(() => {
    vi.useRealTimers()
    WebSocketFalso.instancias = []
    vi.unstubAllGlobals()
  })

  it('criterio 1: pide consentimiento antes de solicitar el token y permite continuar', async () => {
    instalarAPIsDeVoz()
    const peticiones = simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await userEvent.click(screen.getByRole('button', { name: 'Activar asistente de voz' }))
    expect(peticiones).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(peticiones).toHaveLength(1))
  })

  it('VOICE-7 DoD: permiso de micrófono denegado conserva el uso manual', async () => {
    const apis = instalarAPIsDeVoz()
    apis.getUserMedia.mockRejectedValue(new DOMException('Permiso denegado', 'NotAllowedError'))
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    const callbacks = renderAsistente()
    await continuar()
    expect(await screen.findByText(/No se pudo activar el asistente/)).toBeInTheDocument()
    expect(callbacks.setValue).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Activar asistente de voz' })).toBeEnabled()
  })

  it('VOICE-7 DoD: navegador sin APIs de audio informa el modo manual sin pedir token', async () => {
    instalarAPIsDeVoz()
    vi.stubGlobal('AudioWorkletNode', undefined)
    const peticiones = simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await userEvent.click(screen.getByRole('button', { name: 'Activar asistente de voz' }))
    expect(screen.getByText(/Este navegador no permite usar el micrófono/)).toBeInTheDocument()
    expect(peticiones).toHaveLength(0)
  })

  it('VOICE-7 DoD: un 503 de token conserva el formulario manual', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ detail: 'Servicio no disponible' }, 503) })
    const callbacks = renderAsistente()
    await continuar()
    expect(await screen.findByText(/No se pudo activar el asistente/)).toBeInTheDocument()
    expect(callbacks.setValue).not.toHaveBeenCalled()
  })

  it('criterio 2: informa estados y pasa a escuchar tras abrir el socket', async () => {
    const apis = instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    expect(screen.getByText('Estado: escuchando')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar asistente de voz' })).toHaveAttribute('aria-pressed', 'true')
    expect(apis.getUserMedia).toHaveBeenCalled()
    expect(apis.audioWorklet.addModule).toHaveBeenCalledWith('/deepgram-audio-worklet.js')
    expect(apis.contexto.createMediaStreamSource).toHaveBeenCalled()
    expect(apis.contexto.createAnalyser).toHaveBeenCalled()
    expect(apis.contexto.createGain).toHaveBeenCalled()
    expect(apis.contexto.resume).toHaveBeenCalled()
    expect(apis.AudioWorkletNodeFalso).toHaveBeenCalled()
    expect(apis.requestAnimationFrame).toHaveBeenCalled()
  })

  it('criterio 3: envía el token temporal únicamente como subprotocolo bearer', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    const socket = WebSocketFalso.instancias[0]
    expect(socket.url).toMatch(/^wss:\/\/api\.deepgram\.com\/v1\/listen\?/)
    expect(socket.url).not.toContain('jwt-temporal')
    expect(socket.url).not.toContain('clave')
    expect(socket.protocols).toEqual(['bearer', 'jwt-temporal'])
  })

  it('criterio 4: solo procesa speech_final y descarta el mismo turno repetido', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    const callbacks = renderAsistente()
    await conectar()
    await emitirTranscripcion('Nombre: Feria', false)
    expect(callbacks.setValue).not.toHaveBeenCalled()
    await emitirTranscripcion('Nombre: Feria')
    await emitirTranscripcion('Nombre: Feria')
    expect(callbacks.setValue).toHaveBeenCalledTimes(1)
    expect(callbacks.setValue).toHaveBeenCalledWith('nombre', 'Feria', { shouldValidate: true, shouldDirty: true })
  })

  it('criterio 5: conserva y muestra transcripciones en el orden de llegada', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    await emitirTranscripcion('Nombre: Feria')
    await emitirTranscripcion('Responsable: Club de ciencia')
    const panel = within(screen.getByRole('region', { name: 'Asistente de voz' }))
      .getAllByRole('status')
      .find((status) => status.textContent?.includes('Lo reconocido:'))
    expect(panel).toHaveTextContent('Nombre: Feria Responsable: Club de ciencia')
  })

  it('RNF-010: conserva una transcripción larga y caracteres especiales como texto', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    const callbacks = renderAsistente()
    await conectar()
    const valor = 'á&<>"'.repeat(2_000)
    await emitirTranscripcion(`Nombre: ${valor}`)
    await waitFor(() => expect(callbacks.setValue).toHaveBeenCalledWith(
      'nombre',
      valor,
      { shouldValidate: true, shouldDirty: true },
    ))
    const panel = within(screen.getByRole('region', { name: 'Asistente de voz' }))
      .getAllByRole('status')
      .find((status) => status.textContent?.includes('Lo reconocido:'))
    expect(panel).toHaveTextContent(valor)
    expect(document.querySelector('script:not([src])')).toBeNull()
  })

  it('criterio 6: presenta mensajes y permite elegir entre ubicaciones ambiguas', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    const callbacks = renderAsistente()
    await conectar()
    await emitirTranscripcion('Ubicación: Biblioteca')
    const opciones = screen.getByRole('group', { name: 'Opciones de ubicación' })
    expect(within(opciones).getByRole('button', { name: 'Biblioteca Central' })).toBeInTheDocument()
    expect(screen.getByText(/Encontré varias ubicaciones/)).toBeInTheDocument()
    await userEvent.click(within(opciones).getByRole('button', { name: 'Biblioteca Central' }))
    expect(callbacks.setValue).toHaveBeenCalledWith('ubicacion', '7', { shouldValidate: true, shouldDirty: true })
    expect(screen.queryByRole('group', { name: 'Opciones de ubicación' })).not.toBeInTheDocument()
  })

  it('VOICE-8: muestra un ejemplo de instrucciones', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await userEvent.click(screen.getByRole('button', { name: 'Ver ejemplos de instrucciones' }))
    expect(screen.getByText(/Ejemplo:/)).toBeInTheDocument()
  })

  it('VOICE-8 c2: el comando hablado «ayuda» presenta ayuda contextual', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    await emitirTranscripcion('Ayuda')
    expect(await screen.findByText(/Ejemplo:/)).toBeInTheDocument()
  })

  it('VOICE-7 DoD: cierra la captura tras 60 segundos sin voz', async () => {
    const apis = instalarAPIsDeVoz()
    const temporizador = vi.spyOn(window, 'setTimeout')
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    await emitirTranscripcion('Nombre: Feria')
    const cierre = temporizador.mock.calls.find(([, milisegundos]) => milisegundos === 60_000)?.[0]
    expect(cierre).toBeTypeOf('function')
    act(() => (cierre as () => void)())
    expect(WebSocketFalso.instancias[0].close).toHaveBeenCalled()
    expect(apis.pista.stop).toHaveBeenCalled()
    expect(apis.contexto.close).toHaveBeenCalled()
  })

  it('VOICE-7 DoD: detener libera pistas, WebSocket y AudioContext', async () => {
    const apiVoz = instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar asistente de voz' }))
    expect(apiVoz.pista.stop).toHaveBeenCalled()
    expect(WebSocketFalso.instancias[0].close).toHaveBeenCalled()
    expect(apiVoz.contexto.close).toHaveBeenCalled()
  })

  it('VOICE-7 DoD: desmontar libera recursos activos', async () => {
    const apiVoz = instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    const { unmount } = render(<AsistenteVoz
      categorias={categorias}
      ubicaciones={ubicaciones}
      setValue={vi.fn()}
      appendFecha={vi.fn()}
      onFieldsVoice={vi.fn()}
    />)
    await conectar()
    unmount()
    expect(apiVoz.pista.stop).toHaveBeenCalled()
    expect(WebSocketFalso.instancias[0].close).toHaveBeenCalled()
    expect(apiVoz.contexto.close).toHaveBeenCalled()
  })

  it('VOICE-7 DoD: expresa errores de Deepgram sin revelar detalles de credenciales', async () => {
    instalarAPIsDeVoz()
    simularApi({ 'POST /api/auth/voz/token/': () => json({ access_token: 'jwt-temporal', expires_in: 30 }) })
    renderAsistente()
    await conectar()
    act(() => WebSocketFalso.instancias[0].mensaje({ type: 'Error', description: 'fallo de prueba' }))
    expect(screen.getByText(/Deepgram no pudo procesar el audio/)).toBeInTheDocument()
    act(() => WebSocketFalso.instancias[0].error())
    expect(screen.getByText(/No fue posible conectar con el servicio de voz/)).toBeInTheDocument()
    expect(screen.queryByText(/API key|rol Member/i)).not.toBeInTheDocument()
    act(() => WebSocketFalso.instancias[0].cerrar(1011))
    expect(screen.getByText(/La conexión de voz terminó inesperadamente/)).toBeInTheDocument()
    expect(screen.queryByText(/código 1011|API key|rol Member/i)).not.toBeInTheDocument()
  })
})

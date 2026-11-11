import { vi } from 'vitest'
import { act } from '@testing-library/react'

export class WebSocketFalso {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3
  static instancias: WebSocketFalso[] = []
  readyState = WebSocketFalso.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = WebSocketFalso.CLOSED
  })

  constructor(public url: string, public protocols?: string | string[]) {
    WebSocketFalso.instancias.push(this)
  }

  abrir() {
    this.readyState = WebSocketFalso.OPEN
    this.onopen?.(new Event('open'))
  }

  mensaje(datos: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(datos) } as MessageEvent)
  }

  error() {
    this.onerror?.(new Event('error'))
  }

  cerrar(code = 1006) {
    this.readyState = WebSocketFalso.CLOSED
    this.onclose?.({ code } as CloseEvent)
  }
}

export function instalarAPIsDeVoz() {
  WebSocketFalso.instancias = []
  const pista = { stop: vi.fn() }
  const flujo = { getTracks: () => [pista] }
  const getUserMedia = vi.fn().mockResolvedValue(flujo)

  const fuente = { connect: vi.fn(), disconnect: vi.fn() }
  const analizador = {
    fftSize: 0,
    frequencyBinCount: 256,
    getByteTimeDomainData: (datos: Uint8Array) => datos.fill(128),
  }
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
  const audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
  const contexto = {
    audioWorklet,
    sampleRate: 16_000,
    destination: {},
    createMediaStreamSource: vi.fn(() => fuente),
    createAnalyser: vi.fn(() => analizador),
    createGain: vi.fn(() => gain),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const worklet = { port: { onmessage: null as ((event: MessageEvent) => void) | null }, connect: vi.fn(), disconnect: vi.fn() }
  const AudioContextFalso = vi.fn(function AudioContextFalso() {
    return contexto
  })
  const AudioWorkletNodeFalso = vi.fn(function AudioWorkletNodeFalso() {
    return worklet
  })
  const requestAnimationFrame = vi.fn(() => 1)
  const cancelAnimationFrame = vi.fn()
  vi.stubGlobal('WebSocket', WebSocketFalso)
  vi.stubGlobal('AudioContext', AudioContextFalso)
  vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeFalso)
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
  vi.stubGlobal(
    'navigator',
    Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
      mediaDevices: { getUserMedia },
    }),
  )
  return {
    pista,
    flujo,
    getUserMedia,
    contexto,
    audioWorklet,
    fuente,
    analizador,
    gain,
    worklet,
    AudioContextFalso,
    AudioWorkletNodeFalso,
    requestAnimationFrame,
    cancelAnimationFrame,
  }
}

export async function emitirTranscripcion(texto: string, speechFinal = true, isFinal = true) {
  await act(async () => {
    WebSocketFalso.instancias.at(-1)?.mensaje({
      is_final: isFinal,
      speech_final: speechFinal,
      channel: { alternatives: [{ transcript: texto }] },
    })
    await new Promise<void>((resolver) => setTimeout(resolver, 0))
  })
}

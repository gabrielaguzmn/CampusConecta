import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, HelpCircle } from 'lucide-react'
import { api, todosLosMensajes } from '../api/client'
import { interpretarVoz, type CatalogItem } from '../lib/voiceInterpreter'

export type CampoVoz = 'nombre' | 'descripcion' | 'responsable' | 'detalle_ubicacion' | 'cupo' | 'contacto' | 'enlace_externo' | 'categoria' | 'ubicacion'

type Props = {
  categorias: CatalogItem[]
  ubicaciones: CatalogItem[]
  setValue: (campo: CampoVoz, valor: string, opciones?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void
  validar: () => Promise<boolean>
  onCreateRequested: () => void
  appendFecha: (fecha: { inicio: string; fin: string }) => void
  onFieldsVoice: (campos: CampoVoz[]) => void
}

type Estado = 'desconectado' | 'conectando' | 'escuchando' | 'procesando'

export function AsistenteVoz({ categorias, ubicaciones, setValue, validar, onCreateRequested, appendFecha, onFieldsVoice }: Props) {
  const [estado, setEstado] = useState<Estado>('desconectado')
  const [consentimiento, setConsentimiento] = useState(false)
  const [transcripcionReconocida, setTranscripcionReconocida] = useState('')
  const [transcripcionActual, setTranscripcionActual] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [mensajes, setMensajes] = useState<string[]>([])
  const [ambiguedades, setAmbiguedades] = useState<CatalogItem[]>([])
  const historialTranscripciones = useRef<string[]>([])
  const socket = useRef<WebSocket | undefined>(undefined)
  const stream = useRef<MediaStream | undefined>(undefined)
  const contextoAudio = useRef<AudioContext | undefined>(undefined)
  const procesadorAudio = useRef<AudioWorkletNode | undefined>(undefined)
  const fuenteAudio = useRef<MediaStreamAudioSourceNode | undefined>(undefined)
  const ultimoTurnoProcesado = useRef('')
  const analizadorAudio = useRef<AnalyserNode | undefined>(undefined)
  const marcoAudio = useRef<number | undefined>(undefined)

  function liberar() {
    procesadorAudio.current?.disconnect()
    fuenteAudio.current?.disconnect()
    void contextoAudio.current?.close()
    if (marcoAudio.current) cancelAnimationFrame(marcoAudio.current)
    stream.current?.getTracks().forEach((track) => track.stop())
    socket.current?.close()
    procesadorAudio.current = undefined
    fuenteAudio.current = undefined
    contextoAudio.current = undefined
    analizadorAudio.current = undefined
    marcoAudio.current = undefined
    stream.current = undefined
    socket.current = undefined
    ultimoTurnoProcesado.current = ''
    setNivelAudio(0)
    setEstado('desconectado')
  }

  useEffect(() => liberar, [])

  function procesar(texto: string) {
    setEstado('procesando')
    setTranscripcionActual('')
    const resultado = interpretarVoz(texto, categorias, ubicaciones)
    for (const [campo, valor] of Object.entries(resultado.fields)) {
      setValue(campo as CampoVoz, valor, { shouldValidate: true, shouldDirty: true })
    }
    onFieldsVoice(Object.keys(resultado.fields) as CampoVoz[])
    if (resultado.categoria) {
      setValue('categoria', String(resultado.categoria), { shouldValidate: true, shouldDirty: true })
      onFieldsVoice(['categoria'])
    }
    if (resultado.ubicacion) {
      setValue('ubicacion', String(resultado.ubicacion), { shouldValidate: true, shouldDirty: true })
      onFieldsVoice(['ubicacion'])
    }
    for (const fecha of resultado.dates ?? (resultado.date ? [resultado.date] : [])) appendFecha(fecha)
    window.setTimeout(() => {
      void validar().then((esValido) => {
        if (resultado.crearEvento && esValido) onCreateRequested()
      })
    }, 0)
    setAmbiguedades(resultado.ambiguousUbicaciones ?? [])
    setMensajes(resultado.messages)
    setEstado('escuchando')
  }

  async function activar() {
    if (estado !== 'desconectado') return liberar()
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode || !window.WebSocket) {
      setMensajes(['Este navegador no permite usar el micrófono. Puedes completar el formulario manualmente.'])
      return
    }
    if (!consentimiento) {
      setMensajes(['La voz se procesa mediante Deepgram, un servicio externo. Al continuar se solicitará permiso para usar el micrófono.'])
      setConsentimiento(true)
      return
    }
    setEstado('conectando')
    try {
      const { data, error } = await api.POST('/api/auth/voz/token/', {})
      if (error || !data?.access_token) throw new Error(todosLosMensajes(error).join(' '))
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const contexto = new AudioContext()
      await contexto.audioWorklet.addModule('/deepgram-audio-worklet.js')
      await contexto.resume()
      const fuente = contexto.createMediaStreamSource(stream.current)
      const analizador = contexto.createAnalyser()
      analizador.fftSize = 512
      fuente.connect(analizador)
      analizadorAudio.current = analizador
      const medirAudio = () => {
        const datos = new Uint8Array(analizador.frequencyBinCount)
        analizador.getByteTimeDomainData(datos)
        let energia = 0
        for (const dato of datos) {
          const amplitud = (dato - 128) / 128
          energia += amplitud * amplitud
        }
        setNivelAudio(Math.sqrt(energia / datos.length))
        marcoAudio.current = requestAnimationFrame(medirAudio)
      }
      medirAudio()
      const procesador = new AudioWorkletNode(contexto, 'deepgram-audio-processor')
      const silencio = contexto.createGain()
      silencio.gain.value = 0
      fuente.connect(procesador)
      procesador.connect(silencio)
      silencio.connect(contexto.destination)
      contextoAudio.current = contexto
      fuenteAudio.current = fuente
      procesadorAudio.current = procesador
      const url =
        `wss://api.deepgram.com/v1/listen?model=nova-3&language=es&encoding=linear16&sample_rate=${contexto.sampleRate}&channels=1&smart_format=true&interim_results=true&endpointing=500&utterance_end_ms=1000`
      // Deepgram expects temporary JWTs as the bearer WebSocket subprotocol.
      // The `token` subprotocol is for long-lived API keys.
      const ws = new WebSocket(url, ['bearer', data.access_token])
      socket.current = ws
      ws.onopen = () => {
        try {
          procesador.port.onmessage = (event: MessageEvent<{ audio: ArrayBuffer; nivel: number }>) => {
            if (ws.readyState !== WebSocket.OPEN) return
            ws.send(event.data.audio)
          }
          setEstado('escuchando')
          setMensajes(['Escuchando. Di una instrucción completa y haz una pausa.'])
        } catch {
          setMensajes(['El navegador no pudo iniciar la captura de audio. Puedes continuar llenando el formulario a mano.'])
          liberar()
        }
      }
      ws.onmessage = (event) => {
        const respuesta = JSON.parse(event.data) as {
          is_final?: boolean
          speech_final?: boolean
          channel?: { alternatives?: Array<{ transcript?: string }> }
          type?: string
          description?: string
        }
        if (respuesta.type === 'Error') {
          setMensajes([`Deepgram no pudo procesar el audio: ${respuesta.description ?? 'error desconocido'}`])
          return
        }
        const texto = respuesta.channel?.alternatives?.[0]?.transcript?.trim()
        if (!texto) return
        setTranscripcionActual(texto)
        // `is_final` puede llegar varias veces durante un mismo turno. Solo
        // `speech_final` indica que la persona terminó de hablar.
        if (!respuesta.speech_final || ultimoTurnoProcesado.current === texto) return
        ultimoTurnoProcesado.current = texto
        if (!historialTranscripciones.current.includes(texto)) {
          historialTranscripciones.current = [...historialTranscripciones.current, texto]
          setTranscripcionReconocida(historialTranscripciones.current.join(' '))
        }
        procesar(texto)
      }
      ws.onerror = () => {
        setMensajes(['Deepgram rechazó la conexión de voz. Verifica el token temporal y el permiso Member de la API key.'])
      }
      ws.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          setMensajes([`Deepgram cerró la conexión (código ${event.code}). Verifica que la API key tenga rol Member y que el token no haya expirado.`])
        }
        setEstado('desconectado')
      }
    } catch {
      liberar()
      setMensajes(['No se pudo activar el asistente. Revisa el permiso del micrófono o continúa a mano.'])
    }
  }

  function elegirUbicacion(id: number) {
    setValue('ubicacion', String(id), { shouldValidate: true, shouldDirty: true })
    setAmbiguedades([])
  }

  return (
    <section aria-label="Asistente de voz" className="relative flex flex-col gap-3 rounded-control border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={activar} aria-label={estado === 'desconectado' ? 'Activar asistente de voz' : 'Desactivar asistente de voz'} aria-pressed={estado !== 'desconectado'} className="flex h-11 items-center gap-2 rounded-control bg-primario px-4 text-sm font-semibold text-white">
          {estado === 'desconectado' ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
          {estado === 'desconectado' ? 'Activar voz' : 'Desactivar voz'}
        </button>
        <span role="status" aria-live="polite" className="text-sm font-semibold">Estado: {estado}</span>
        {estado === 'escuchando' && (
          <span className="flex items-center gap-2 text-xs text-texto-secundario" aria-label={nivelAudio > 0.01 ? 'Micrófono detectando sonido' : 'Micrófono activo, sin sonido detectado'}>
            <span className="flex h-4 items-end gap-px" aria-hidden>
              {[0.01, 0.03, 0.06, 0.03].map((umbral, i) => (
                <span key={i} className={`w-1 rounded-full bg-primario transition-all ${nivelAudio > umbral ? 'h-4' : 'h-1'}`} />
              ))}
            </span>
            {nivelAudio > 0.01 ? 'Audio detectado' : 'Esperando voz'}
          </span>
        )}
        <button type="button" onClick={() => setMensajes(['Ejemplo: “El nombre del evento es Feria de emprendimiento. La categoría es talleres. La ubicación es Edificio B13. El responsable es Juan. La fecha es el 16 de diciembre de 2026 a las 3 de la tarde.”'])} aria-label="Ver ejemplos de instrucciones" className="ml-auto p-2 text-primario">
          <HelpCircle size={20} aria-hidden />
        </button>
      </div>
      {consentimiento && estado === 'desconectado' && mensajes[0]?.startsWith('La voz') && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{mensajes[0]}</span>
          <button type="button" onClick={activar} className="font-semibold text-primario">Continuar</button>
        </div>
      )}
      {(transcripcionReconocida || transcripcionActual) && (
        <div role="status" aria-live="polite" className="text-sm">
          <strong>Lo reconocido:</strong> {transcripcionReconocida}{transcripcionActual && `${transcripcionReconocida ? ' ' : ''}${transcripcionActual}`}
        </div>
      )}
      {ambiguedades.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones de ubicación">{ambiguedades.map((item) => <button type="button" key={item.id} onClick={() => elegirUbicacion(item.id)} className="rounded-control border border-primario px-3 py-2 text-sm">{item.nombre}</button>)}</div>}
      {mensajes.length > 0 && <p role="status" className="text-sm text-texto-secundario">{mensajes.join(' ')}</p>}
    </section>
  )
}

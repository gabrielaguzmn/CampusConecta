import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, HelpCircle } from 'lucide-react'
import { api, todosLosMensajes } from '../api/client'
import { comandoDicho, fechaEnPalabras, interpretarRespuesta, type CatalogItem, type PasoVoz } from '../lib/voiceInterpreter'

export type CampoVoz = 'nombre' | 'descripcion' | 'responsable' | 'detalle_ubicacion' | 'cupo' | 'contacto' | 'enlace_externo' | 'categoria' | 'ubicacion'
type Fecha = { inicio: string; fin: string }

type Props = {
  categorias: CatalogItem[]
  ubicaciones: CatalogItem[]
  setValue: (campo: CampoVoz, valor: string, opciones?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void
  /** Agrega la fecha y devuelve su posición en la lista de fechas. */
  appendFecha: (fecha: Fecha) => number
  /** Quita una fecha agregada por voz (al decir «corregir»). */
  quitarFecha: (indice: number) => void
  onFieldsVoice: (campos: CampoVoz[]) => void
  /** Valor actual del campo; las preguntas de campos ya llenos a mano se saltan. */
  valorActual: (campo: CampoVoz) => string
  tieneFecha: () => boolean
}

type Estado = 'desconectado' | 'conectando' | 'hablando' | 'escuchando' | 'procesando'

type Paso = { paso: PasoVoz; etiqueta: string; pregunta: string; ejemplo: string; obligatorio?: boolean }

// Orden de las preguntas: el mismo del formulario.
export const PASOS: Paso[] = [
  { paso: 'nombre', etiqueta: 'Nombre', pregunta: '¿Cuál es el nombre del evento?', ejemplo: 'Feria de emprendimiento', obligatorio: true },
  { paso: 'descripcion', etiqueta: 'Descripción', pregunta: '¿Cuál es la descripción del evento?', ejemplo: 'Venta de productos hechos por estudiantes', obligatorio: true },
  { paso: 'categoria', etiqueta: 'Categoría', pregunta: '¿Qué categoría tiene el evento?', ejemplo: 'Talleres', obligatorio: true },
  { paso: 'ubicacion', etiqueta: 'Ubicación', pregunta: '¿En qué lugar del campus será?', ejemplo: 'Edificio B13', obligatorio: true },
  { paso: 'detalle_ubicacion', etiqueta: 'Ubicación exacta', pregunta: '¿Cuál es la ubicación exacta? Es opcional.', ejemplo: 'Salón 2001' },
  { paso: 'responsable', etiqueta: 'Responsable', pregunta: '¿Quién es el responsable del evento?', ejemplo: 'Grupo Dulce Valle', obligatorio: true },
  { paso: 'fecha', etiqueta: 'Fecha', pregunta: '¿Qué día es y a qué hora empieza y termina?', ejemplo: 'El 20 de noviembre de 2 a 5 de la tarde, o mañana a las 10 de la mañana durante dos horas', obligatorio: true },
  { paso: 'otraFecha', etiqueta: 'Otra fecha', pregunta: '¿Quieres agregar otra fecha?', ejemplo: 'Sí o no' },
  { paso: 'cupo', etiqueta: 'Cupo', pregunta: '¿Cuál es el cupo máximo? Es opcional.', ejemplo: '30' },
  { paso: 'contacto', etiqueta: 'Contacto', pregunta: '¿Cuál es el contacto? Puede ser un número o un correo. Es opcional.', ejemplo: '300 123 4567, o juan arroba correo punto com' },
  { paso: 'enlace_externo', etiqueta: 'Enlace', pregunta: '¿Tiene un enlace externo? Es opcional.', ejemplo: 'forms punto gle barra feria' },
]
const indicePaso = (paso: PasoVoz) => PASOS.findIndex((p) => p.paso === paso)

const SALUDO = 'Hola, te ayudo a crear el evento. Responde cada pregunta; puedes decir omitir, corregir, repetir, ayuda o terminar.'
const FINAL = 'Terminé las preguntas. Revisa el formulario y dale a Crear evento.'
// Deepgram cierra la respuesta tras 1 s de silencio (endpointing) o, con ruido de fondo, con UtteranceEnd a 1,5 s.
const PARAMETROS_DEEPGRAM = 'model=nova-3&language=es&encoding=linear16&channels=1&smart_format=true&interim_results=true&endpointing=1000&utterance_end_ms=1500'
// Al dictar un número por partes se espera un poco más antes de darlo por terminado.
const ESPERA_NUMERO_MS = 2500

// Palabras que empiezan antes de que termine la voz del asistente son eco del parlante (o se dijeron encima) y se
// descartan. Margen en segundos para la latencia entre el parlante, el micrófono y el envío por bloques de 100 ms.
const MARGEN_ECO_S = 0.15

type Palabra = { word: string; punctuated_word?: string; start: number; end: number }

export function AsistenteVoz(props: Props) {
  const [estado, setEstado] = useState<Estado>('desconectado')
  const [consentimiento, setConsentimiento] = useState(false)
  const [transcripcionReconocida, setTranscripcionReconocida] = useState('')
  const [transcripcionActual, setTranscripcionActual] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [mensajes, setMensajes] = useState<string[]>([])
  const [asistenteDice, setAsistenteDice] = useState('')
  const [pasoActual, setPasoActual] = useState<number>()
  const [ambiguedades, setAmbiguedades] = useState<CatalogItem[]>([])
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const [sinAudio, setSinAudio] = useState(false)
  const historialTranscripciones = useRef<string[]>([])
  const socket = useRef<WebSocket | undefined>(undefined)
  const stream = useRef<MediaStream | undefined>(undefined)
  const contextoAudio = useRef<AudioContext | undefined>(undefined)
  const procesadorAudio = useRef<AudioWorkletNode | undefined>(undefined)
  const fuenteAudio = useRef<MediaStreamAudioSourceNode | undefined>(undefined)
  const marcoAudio = useRef<number | undefined>(undefined)
  const temporizadorInactividad = useRef<number | undefined>(undefined)
  const temporizadorNumero = useRef<number | undefined>(undefined)
  // Segundos de audio enviados a Deepgram: es la misma escala de tiempo de sus marcas por palabra.
  const segundosEnviados = useRef(0)
  // Momento (en esa escala) en que el asistente terminó de hablar; mientras habla vale Infinity.
  const finHabla = useRef(Number.POSITIVE_INFINITY)
  const fragmentosFrase = useRef<string[]>([])
  // Mientras el asistente habla no se envía el micrófono a Deepgram, para que no transcriba su propia voz.
  const hablando = useRef(false)
  const ocupado = useRef(false)
  const audioActual = useRef<{ audio: HTMLAudioElement; terminar: () => void } | undefined>(undefined)
  const cacheAudio = useRef(new Map<string, Blob>())
  const indice = useRef(0)
  const historialPasos = useRef<number[]>([])
  const fechasPorVoz = useRef<number[]>([])
  const pendiente = useRef<string | undefined>(undefined)
  const opciones = useRef<CatalogItem[] | undefined>(undefined)
  // Los manejadores del WebSocket se crean una vez; leen siempre las props más recientes (catálogos ya cargados).
  const ultimasProps = useRef(props)
  useEffect(() => {
    ultimasProps.current = props
  })

  function liberar() {
    const ws = socket.current
    socket.current = undefined
    audioActual.current?.audio.pause()
    audioActual.current?.terminar()
    audioActual.current = undefined
    procesadorAudio.current?.disconnect()
    fuenteAudio.current?.disconnect()
    void contextoAudio.current?.close()
    if (marcoAudio.current) cancelAnimationFrame(marcoAudio.current)
    for (const t of [temporizadorInactividad, temporizadorNumero]) {
      if (t.current) window.clearTimeout(t.current)
      t.current = undefined
    }
    stream.current?.getTracks().forEach((track) => track.stop())
    ws?.close()
    procesadorAudio.current = undefined
    fuenteAudio.current = undefined
    contextoAudio.current = undefined
    marcoAudio.current = undefined
    stream.current = undefined
    fragmentosFrase.current = []
    hablando.current = false
    ocupado.current = false
    pendiente.current = undefined
    opciones.current = undefined
    setPasoActual(undefined)
    setAmbiguedades([])
    setTranscripcionActual('')
    setNivelAudio(0)
    setEstado('desconectado')
  }

  function programarCierrePorInactividad() {
    if (temporizadorInactividad.current) window.clearTimeout(temporizadorInactividad.current)
    temporizadorInactividad.current = window.setTimeout(() => {
      liberar()
      setMensajes(['El asistente se pausó tras 60 segundos sin voz. Lo que completaste queda en el formulario.'])
    }, 60_000)
  }

  useEffect(() => liberar, [])

  async function pedirAudio(texto: string) {
    const guardado = cacheAudio.current.get(texto)
    if (guardado) return guardado
    const { data, error } = await api.POST('/api/auth/voz/hablar/', { body: { texto }, parseAs: 'blob' })
    if (error || !(data instanceof Blob)) throw new Error('sin audio')
    cacheAudio.current.set(texto, data)
    return data
  }

  async function reproducir(blob: Blob) {
    if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') throw new Error('sin audio')
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    await new Promise<void>((resolver) => {
      audioActual.current = { audio, terminar: resolver }
      audio.onended = () => resolver()
      audio.onerror = () => resolver()
      audio.play().catch(() => resolver())
    })
    audioActual.current = undefined
    URL.revokeObjectURL(url)
  }

  /** El asistente dice el texto (y lo muestra); al terminar vuelve a escuchar. */
  async function decir(texto: string) {
    const ws = socket.current
    if (!ws) return
    hablando.current = true
    finHabla.current = Number.POSITIVE_INFINITY
    fragmentosFrase.current = []
    setAsistenteDice(texto)
    setEstado('hablando')
    try {
      await reproducir(await pedirAudio(texto))
    } catch {
      setSinAudio(true)
    }
    if (socket.current !== ws) return
    // El micrófono nunca se apaga: así una respuesta inmediata («sí») no se pierde. Lo dicho antes de este momento
    // se descarta por sus marcas de tiempo.
    finHabla.current = segundosEnviados.current
    fragmentosFrase.current = []
    setTranscripcionActual('')
    hablando.current = false
    ocupado.current = false
    setEstado('escuchando')
    programarCierrePorInactividad()
  }

  function preguntaDe(i: number) {
    const paso = PASOS[i]
    const { categorias } = ultimasProps.current
    if (paso.paso === 'categoria' && categorias.length && categorias.length <= 8) {
      return `${paso.pregunta} Las opciones son: ${categorias.map((c) => c.nombre).join(', ')}.`
    }
    return paso.pregunta
  }

  function ir(i: number, prefijo = '') {
    indice.current = i
    pendiente.current = undefined
    opciones.current = undefined
    setAmbiguedades([])
    setPasoActual(i)
    return decir(`${prefijo} ${preguntaDe(i)}`.trim())
  }

  // Siguiente pregunta, saltando los campos que la persona ya llenó a mano.
  function siguientePaso(desde: number) {
    const { valorActual, tieneFecha } = ultimasProps.current
    let i = desde
    while (i < PASOS.length) {
      const { paso } = PASOS[i]
      // Con una fecha ya puesta a mano, se pregunta si quiere agregar otra.
      if (paso === 'fecha' && tieneFecha()) i += 1
      else if (paso !== 'fecha' && paso !== 'otraFecha' && valorActual(paso).trim()) i += 1
      else break
    }
    return i
  }

  async function avanzar(prefijo: string) {
    historialPasos.current.push(indice.current)
    const siguiente = siguientePaso(indice.current + 1)
    if (siguiente >= PASOS.length) {
      await decir(`${prefijo} ${FINAL}`.trim())
      liberar()
      setMensajes([FINAL])
      return
    }
    await ir(siguiente, prefijo)
  }

  function completar(campo: CampoVoz, valor: string) {
    const { setValue, onFieldsVoice } = ultimasProps.current
    setValue(campo, valor, { shouldValidate: true, shouldDirty: true })
    onFieldsVoice([campo])
  }

  async function responder(frase: string) {
    ocupado.current = true
    setEstado('procesando')
    setMensajes([])
    const i = indice.current
    const paso = PASOS[i]
    const comando = comandoDicho(frase)
    if (comando === 'terminar') {
      await decir('Listo, dejo de escuchar. Lo que completaste queda en el formulario.')
      liberar()
      return
    }
    if (comando === 'repetir') return decir(preguntaDe(i))
    // RF-040: la publicación nunca se hace por voz.
    if (comando === 'publicar') return decir(`No creo el evento por voz; cuando termines, dale a Crear evento. ${preguntaDe(i)}`)
    if (comando === 'ayuda') {
      setAyudaAbierta(true)
      return decir(`Por ejemplo: ${paso.ejemplo}. ${preguntaDe(i)}`)
    }
    if (comando === 'corregir') {
      const anterior = historialPasos.current.pop()
      if (anterior === undefined) return decir(`Todavía no hay una respuesta para corregir. ${preguntaDe(i)}`)
      // Si se corrige una fecha dictada, se quita la que se agregó por voz.
      if (PASOS[anterior].paso === 'otraFecha' || PASOS[anterior].paso === 'fecha') {
        const ultima = fechasPorVoz.current.pop()
        if (ultima !== undefined) ultimasProps.current.quitarFecha(ultima)
        return ir(indicePaso('fecha'), 'Quité la última fecha. Dímela de nuevo.')
      }
      return ir(anterior, 'Vamos a corregirlo.')
    }
    if (comando === 'omitir' || (paso.paso === 'otraFecha' && comando)) {
      return avanzar(paso.obligatorio ? 'Lo dejo vacío; complétalo a mano antes de publicar.' : '')
    }

    const { categorias, ubicaciones } = ultimasProps.current
    const anteriorPendiente = pendiente.current
    const r = interpretarRespuesta(paso.paso, frase, { categorias, ubicaciones, opciones: opciones.current, pendiente: anteriorPendiente })
    switch (r.tipo) {
      case 'texto':
        completar(paso.paso as CampoVoz, r.valor)
        return avanzar(r.eco ? `Anoté ${r.eco}.` : 'Anotado.')
      case 'catalogo':
        completar(paso.paso as CampoVoz, String(r.id))
        return avanzar(`Anoté ${r.nombre}.`)
      case 'opciones':
        opciones.current = r.opciones
        setAmbiguedades(r.opciones)
        return decir(`Encontré varias: ${r.opciones.map((o) => o.nombre).join(', ')}. ¿Cuál es?`)
      case 'fecha': {
        fechasPorVoz.current.push(ultimasProps.current.appendFecha(r.fecha))
        pendiente.current = undefined
        historialPasos.current.push(i)
        indice.current = indicePaso('otraFecha')
        setPasoActual(indice.current)
        return decir(`Anoté ${fechaEnPalabras(r.fecha)}. ${PASOS[indice.current].pregunta}`)
      }
      case 'si':
        historialPasos.current.push(i)
        return ir(indicePaso('fecha'), 'Dime la otra fecha.')
      case 'no':
        return avanzar('')
      case 'incompleto':
        pendiente.current = r.pendiente
        if (r.mensaje) return decir(r.mensaje)
        // Número a medias: se sigue escuchando; si la persona no continúa, se toma lo dicho.
        ocupado.current = false
        setEstado('escuchando')
        setMensajes([`Anotando: ${r.pendiente}…`])
        temporizadorNumero.current = window.setTimeout(() => void cerrarNumero(), ESPERA_NUMERO_MS)
        return
      case 'error':
        pendiente.current = undefined
        return decir(`${r.mensaje} ${preguntaDe(i)}`)
    }
  }

  async function cerrarNumero() {
    temporizadorNumero.current = undefined
    const numero = pendiente.current
    pendiente.current = undefined
    if (!numero || !socket.current) return
    ocupado.current = true
    if (numero.replace('+', '').length >= 7) {
      completar('contacto', numero)
      return avanzar(`Anoté ${numero}.`)
    }
    return decir(`No entendí el número completo. ${preguntaDe(indice.current)}`)
  }

  // Une los fragmentos finales de Deepgram y responde con la frase completa.
  function cerrarFrase() {
    const frase = fragmentosFrase.current.join(' ').trim()
    fragmentosFrase.current = []
    setTranscripcionActual('')
    if (!frase || hablando.current || ocupado.current) return
    if (temporizadorNumero.current) {
      window.clearTimeout(temporizadorNumero.current)
      temporizadorNumero.current = undefined
    }
    historialTranscripciones.current = [...historialTranscripciones.current, frase]
    setTranscripcionReconocida(historialTranscripciones.current.join(' '))
    void responder(frase)
  }

  async function activar() {
    if (estado !== 'desconectado') return liberar()
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode || !window.WebSocket) {
      setMensajes(['Este navegador no permite usar el micrófono. Puedes completar el formulario manualmente.'])
      return
    }
    if (!consentimiento) {
      setMensajes(['La voz se procesa mediante Deepgram, un servicio externo, que también lee las preguntas en voz alta. Al continuar se solicitará permiso para usar el micrófono.'])
      setConsentimiento(true)
      return
    }
    setEstado('conectando')
    setMensajes([])
    setSinAudio(false)
    historialPasos.current = []
    fechasPorVoz.current = []
    try {
      const { data, error } = await api.POST('/api/auth/voz/token/', {})
      if (error || !data?.access_token) throw new Error(todosLosMensajes(error).join(' '))
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const contexto = new AudioContext()
      contextoAudio.current = contexto
      await contexto.audioWorklet.addModule('/deepgram-audio-worklet.js')
      await contexto.resume()
      const fuente = contexto.createMediaStreamSource(stream.current)
      const analizador = contexto.createAnalyser()
      analizador.fftSize = 512
      fuente.connect(analizador)
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
      fuenteAudio.current = fuente
      procesadorAudio.current = procesador
      const url = `wss://api.deepgram.com/v1/listen?${PARAMETROS_DEEPGRAM}&sample_rate=${contexto.sampleRate}`
      // Deepgram recibe la credencial temporal (JWT) como subprotocolo «bearer»; nunca va en la URL.
      const ws = new WebSocket(url, ['bearer', data.access_token])
      socket.current = ws
      ws.onopen = () => {
        segundosEnviados.current = 0
        procesador.port.onmessage = (event: MessageEvent<{ audio: ArrayBuffer }>) => {
          if (ws.readyState !== WebSocket.OPEN) return
          ws.send(event.data.audio)
          segundosEnviados.current += event.data.audio.byteLength / 2 / contexto.sampleRate
        }
        void ir(siguientePaso(0), SALUDO)
      }
      ws.onmessage = (event) => {
        if (socket.current !== ws) return
        const respuesta = JSON.parse(event.data) as {
          type?: string
          is_final?: boolean
          speech_final?: boolean
          channel?: { alternatives?: Array<{ transcript?: string; words?: Palabra[] }> }
          description?: string
        }
        if (respuesta.type === 'Error') {
          setMensajes([`Deepgram no pudo procesar el audio: ${respuesta.description ?? 'error desconocido'}`])
          return
        }
        if (hablando.current || ocupado.current) return
        if (respuesta.type === 'UtteranceEnd') {
          cerrarFrase()
          return
        }
        if (!respuesta.channel) return
        const alternativa = respuesta.channel.alternatives?.[0]
        let texto = alternativa?.transcript?.trim() ?? ''
        const palabras = alternativa?.words ?? []
        const propias = palabras.filter((p) => p.start >= finHabla.current - MARGEN_ECO_S)
        if (propias.length < palabras.length) texto = propias.map((p) => p.punctuated_word ?? p.word).join(' ')
        if (texto) {
          programarCierrePorInactividad()
          if (temporizadorNumero.current) {
            window.clearTimeout(temporizadorNumero.current)
            temporizadorNumero.current = undefined
          }
        }
        if (!respuesta.is_final) {
          setTranscripcionActual([...fragmentosFrase.current, texto].join(' ').trim())
          return
        }
        if (texto) fragmentosFrase.current = [...fragmentosFrase.current, texto]
        setTranscripcionActual(fragmentosFrase.current.join(' '))
        if (respuesta.speech_final) cerrarFrase()
      }
      ws.onerror = () => {
        if (socket.current !== ws) return
        liberar()
        setMensajes(['No fue posible conectar con el servicio de voz. Puedes continuar completando el formulario manualmente.'])
      }
      ws.onclose = (event) => {
        if (socket.current !== ws) return
        liberar()
        if (event.code !== 1000 && event.code !== 1005) {
          setMensajes(['La conexión de voz terminó inesperadamente. Puedes continuar completando el formulario manualmente.'])
        }
      }
    } catch {
      liberar()
      setMensajes(['No se pudo activar el asistente. Revisa el permiso del micrófono o continúa a mano.'])
    }
  }

  function elegirUbicacion(item: CatalogItem) {
    if (hablando.current || PASOS[indice.current]?.paso !== 'ubicacion') return
    ocupado.current = true
    completar('ubicacion', String(item.id))
    void avanzar(`Anoté ${item.nombre}.`)
  }

  const avisoConsentimiento = consentimiento && estado === 'desconectado' && mensajes[0]?.startsWith('La voz')

  return (
    <section aria-label="Asistente de voz" className="relative flex flex-col gap-3 rounded-control border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={activar} aria-label={estado === 'desconectado' ? 'Activar asistente de voz' : 'Desactivar asistente de voz'} aria-pressed={estado !== 'desconectado'} className="flex h-11 items-center gap-2 rounded-control bg-primario px-4 text-sm font-semibold text-white">
          {estado === 'desconectado' ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
          {estado === 'desconectado' ? 'Llenar con voz' : 'Detener voz'}
        </button>
        <span role="status" aria-live="polite" className="text-sm font-semibold">Estado: {estado}</span>
        {estado === 'escuchando' && (
          <span className="flex items-center gap-2 text-xs text-texto-secundario" aria-label={nivelAudio > 0.01 ? 'Micrófono detectando sonido' : 'Micrófono activo, sin sonido detectado'}>
            <span className="flex h-4 items-end gap-px" aria-hidden>
              {[0.01, 0.03, 0.06, 0.03].map((umbral, i) => (
                <span key={i} className={`w-1 rounded-full bg-primario transition-all ${nivelAudio > umbral ? 'h-4' : 'h-1'}`} />
              ))}
            </span>
            {nivelAudio > 0.01 ? 'Audio detectado' : 'Esperando tu respuesta'}
          </span>
        )}
        <button type="button" onClick={() => setAyudaAbierta((abierta) => !abierta)} aria-label="Ver ejemplos de instrucciones" aria-expanded={ayudaAbierta} className="ml-auto p-2 text-primario">
          <HelpCircle size={20} aria-hidden />
        </button>
      </div>
      {avisoConsentimiento && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{mensajes[0]}</span>
          <button type="button" onClick={activar} className="font-semibold text-primario">Continuar</button>
        </div>
      )}
      {ayudaAbierta && (
        <div className="rounded-control bg-fondo p-3 text-sm" aria-label="Ayuda del asistente de voz">
          <p className="mb-2">El asistente pregunta cada campo y repite lo que entendió. Responde solo con el valor. Ejemplo: a «¿Cuál es el nombre del evento?» responde «Feria de emprendimiento».</p>
          <ul className="mb-2 flex flex-col gap-1">
            {PASOS.map(({ etiqueta, ejemplo }) => (
              <li key={etiqueta}><strong>{etiqueta}:</strong> «{ejemplo}»</li>
            ))}
          </ul>
          <p>En cualquier momento puedes decir «omitir», «corregir», «repetir», «ayuda» o «terminar».</p>
        </div>
      )}
      {asistenteDice && estado !== 'desconectado' && (
        <p role="status" aria-live="polite" className="text-sm">
          <strong>Asistente{pasoActual !== undefined ? ` · ${PASOS[pasoActual].etiqueta}` : ''}:</strong> {asistenteDice}
        </p>
      )}
      {sinAudio && estado !== 'desconectado' && <p className="text-xs text-texto-secundario">No se pudo reproducir la voz del asistente; lee la pregunta en pantalla.</p>}
      {(transcripcionReconocida || transcripcionActual) && (
        <div role="status" aria-live="polite" className="text-sm">
          <strong>Lo reconocido:</strong> {transcripcionReconocida}{transcripcionActual && `${transcripcionReconocida ? ' ' : ''}${transcripcionActual}`}
        </div>
      )}
      {ambiguedades.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones de ubicación">{ambiguedades.map((item) => <button type="button" key={item.id} onClick={() => elegirUbicacion(item)} className="rounded-control border border-primario px-3 py-2 text-sm">{item.nombre}</button>)}</div>}
      {mensajes.length > 0 && !avisoConsentimiento && <p role="status" className="text-sm text-texto-secundario">{mensajes.join(' ')}</p>}
    </section>
  )
}

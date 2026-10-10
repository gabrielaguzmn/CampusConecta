import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { MapPin, Minus, Plus, RotateCcw } from 'lucide-react'
import type { components } from '../../api/schema'
import { PinMapa } from '../../components/PinMapa'

export type UbicacionMapa = components['schemas']['UbicacionMapa']

export type PropsMapaCampus = {
  ubicaciones: UbicacionMapa[]
  seleccionado?: number
  onSeleccionar: (eventoId: number | undefined) => void
}

const zonas = ['A', 'B', 'C', 'D', 'E'] as const
type Zona = (typeof zonas)[number]
const ancho = 1121
const alto = 916
const limites: Record<Zona, { x: number; y: number; w: number; h: number }> = {
  A: { x: 88, y: 725, w: 527, h: 101 }, B: { x: 94, y: 103, w: 688, h: 615 },
  C: { x: 653, y: 145, w: 437, h: 432 }, D: { x: 606, y: 457, w: 317, h: 339 }, E: { x: 272, y: 289, w: 415, h: 452 },
}
const edificios: Record<Zona, string[]> = {
  A: ['A1.svg', 'A2.svg', 'A7.svg'],
  B: ['B1.svg', 'B2.svg', 'B4.svg', 'B13.svg', 'B14.svg', 'B15.svg', 'B16.svg', 'B17.svg', 'B18.svg', 'B19.svg', 'B20.svg', 'B21.svg', 'B22.svg', 'B24.svg', 'LagoExperimental-interactive.svg'],
  C: ['C5-interactive.svg', 'C7-interactive.svg', 'C9-interactive.svg', 'C10-interactive.svg', 'C11-interactive.svg', 'C12-interactive.svg', 'C13-interactive.svg', 'C14-interactive.svg', 'C15-interactive.svg', 'C16-interactive.svg', 'C17-interactive.svg', 'C18-interactive.svg', 'C19-interactive.svg', 'C20-interactive.svg', 'C21-interactive.svg', 'C22-interactive.svg', 'C23-interactive.svg'],
  D: ['D1-interactive.svg', 'D2-interactive.svg', 'D4-interactive.svg', 'D5-interactive.svg', 'D6-interactive.svg', 'D7-interactive.svg', 'D9-interactive.svg', 'D10-interactive.svg', 'D12-interactive.svg', 'D13-interactive.svg', 'D14-interactive.svg', 'D16-interactive.svg', 'D17-interactive.svg', 'LagoCentral-interactive.svg'],
  E: ['E1.svg', 'E6-E12.svg', 'E15.svg', 'E17.svg', 'E18.svg', 'E19.svg', 'E20.svg', 'E22.svg', 'E23.svg', 'E24.svg', 'E26.svg', 'E27-E28.svg', 'E29-E30.svg', 'E32.svg', 'E33.svg', 'E37.svg', 'E38-E39.svg', 'E42.svg', 'E43.svg', 'E44.svg', 'E46-E47.svg', 'E48.svg', 'E50.svg', 'E52-E53.svg', 'E55.svg', 'E56-E49.svg'],
}
const carpeta = (zona: Zona) => `/zone%20${zona.toLowerCase()}%20builts/`
const complementosZonaE = ['zonaEnombre.svg', 'zonaEPHallDeLosPasosPerdidos.svg', 'zonaEPlazoletaCentral.svg', 'zonaEPlazoletaDeLasPalmeras.svg', 'zonaEPlazoletaIngenieriasl.svg']
const edificioId = (zona: Zona, archivo: string) => `${zona}:${archivo.replace(/-interactive(?=\.svg$)/, '')}`
const listaEdificios = zonas.flatMap((zona) => edificios[zona].map((archivo) => ({ id: edificioId(zona, archivo), zona, archivo })))

export function MapaCampus({ ubicaciones, seleccionado, onSeleccionar }: PropsMapaCampus) {
  const [zoom, setZoom] = useState(1)
  const [zona, setZona] = useState<Zona | null>(null)
  const [hover, setHover] = useState<Zona | null>(null)
  const [hoverEdificio, setHoverEdificio] = useState<string | null>(null)
  const [edificioSeleccionado, setEdificioSeleccionado] = useState<string | null>(null)
  const [alpha, setAlpha] = useState<Partial<Record<Zona, Uint8Array>>>({})
  const [alphaEdificios, setAlphaEdificios] = useState<Record<string, Uint8Array>>({})
  const [limitesEdificios, setLimitesEdificios] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({})
  const [zonasConVacios, setZonasConVacios] = useState<Partial<Record<Zona, string>>>({})
  const [errorPlano, setErrorPlano] = useState(false)

  useEffect(() => {
    let vigente = true
    const cargarMascara = async (src: string) => {
      const img = new Image()
      img.src = src
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject() })
      const canvas = document.createElement('canvas')
      canvas.width = ancho; canvas.height = alto
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas no disponible')
      ctx.drawImage(img, 0, 0, ancho, alto)
      const rgba = ctx.getImageData(0, 0, ancho, alto).data
      const mask = new Uint8Array(ancho * alto)
      const bounds = { x: ancho, y: alto, right: 0, bottom: 0 }
      for (let i = 0; i < mask.length; i += 1) {
        const value = rgba[i * 4 + 3]
        mask[i] = value
        if (value > 16) {
          const x = i % ancho
          const y = Math.floor(i / ancho)
          bounds.x = Math.min(bounds.x, x); bounds.y = Math.min(bounds.y, y)
          bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1)
        }
      }
      return { mask, image: img, bounds: { x: bounds.x, y: bounds.y, w: bounds.right - bounds.x, h: bounds.bottom - bounds.y } }
    }
    Promise.all([
      Promise.all(zonas.map(async (z) => [z, await cargarMascara(`/zones/zona${z}.png`)] as const)),
      Promise.all(listaEdificios.map(async ({ id, zona, archivo }) => [id, await cargarMascara(`${carpeta(zona)}${encodeURIComponent(archivo)}`)] as const)),
    ]).then(([zonasCargadas, edificiosCargados]) => {
      if (!vigente) return
      setAlpha(Object.fromEntries(zonasCargadas.map(([z, datos]) => [z, datos.mask])))
      setAlphaEdificios(Object.fromEntries(edificiosCargados.map(([id, datos]) => [id, datos.mask])))
      setLimitesEdificios(Object.fromEntries(edificiosCargados.map(([id, datos]) => [id, datos.bounds])))
      const zonasVacias: Partial<Record<Zona, string>> = {}
      for (const z of zonas) {
        const base = zonasCargadas.find(([zonaCargada]) => zonaCargada === z)?.[1].image
        if (!base) continue
        const canvas = document.createElement('canvas')
        canvas.width = ancho; canvas.height = alto
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.drawImage(base, 0, 0, ancho, alto)
        ctx.globalCompositeOperation = 'destination-out'
        for (const [id, datos] of edificiosCargados) {
          if (listaEdificios.find((edificio) => edificio.id === id)?.zona === z) ctx.drawImage(datos.image, 0, 0, ancho, alto)
        }
        ctx.globalCompositeOperation = 'source-over'
        zonasVacias[z] = canvas.toDataURL('image/png')
      }
      setZonasConVacios(zonasVacias)
    }).catch(() => { if (vigente) setErrorPlano(true) })
    return () => { vigente = false }
  }, [])

  const eventos = useMemo(() => ubicaciones.flatMap((u) => u.eventos), [ubicaciones])
  const posiciones = useMemo(() => eventos.map((evento, i) => {
    // La API no expone coordenadas: reparte los pines por el plano hasta contar con coordenadas de ubicación.
    const zonaBase = [0.48, 0.32, 0.76, 0.58, 0.39][i % 5]
    const variacion = Math.floor(i / 5)
    return { evento, zona: zonas[i % zonas.length], x: Math.min(0.9, zonaBase + (variacion % 3) * 0.035), y: Math.min(0.88, [0.73, 0.28, 0.3, 0.68, 0.49][i % 5] + variacion * 0.035) }
  }), [eventos])

  function puntoEnMapa(event: MouseEvent<HTMLDivElement>) {
    const r = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - r.left) / r.width) * ancho)
    const y = Math.floor(((event.clientY - r.top) / r.height) * alto)
    if (x < 0 || x >= ancho || y < 0 || y >= alto) return null
    return { x, y, indice: y * ancho + x }
  }

  function zonaEnPunto(event: MouseEvent<HTMLDivElement>): Zona | null {
    const punto = puntoEnMapa(event)
    return punto ? [...zonas].reverse().find((z) => (alpha[z]?.[punto.indice] ?? 0) > 16) ?? null : null
  }

  function edificioEnPunto(event: MouseEvent<HTMLDivElement>, zonaObjetivo: Zona | null): string | null {
    const punto = puntoEnMapa(event)
    if (!punto || !zonaObjetivo) return null
    return [...listaEdificios].reverse().find(({ id, zona: z }) => z === zonaObjetivo && (alphaEdificios[id]?.[punto.indice] ?? 0) > 24)?.id ?? null
  }

  const bounds = zona ? limites[zona] : null
  const escalaZona = bounds ? Math.min(2.4, 0.78 / Math.max(bounds.w / ancho, bounds.h / alto)) : 1
  const centroX = bounds ? (bounds.x + bounds.w / 2) / ancho : 0.5
  const centroY = bounds ? (bounds.y + bounds.h / 2) / alto : 0.5
  // El escenario usa origen (0, 0): desplaza el centro de la zona seleccionada al centro del contenedor.
  const escalaTotal = escalaZona * zoom
  const transform = `translate(${(0.5 - centroX * escalaTotal) * 100}%, ${(0.5 - centroY * escalaTotal) * 100}%) scale(${escalaTotal})`
  const renderZona = (z: Zona, recortada = false) => {
    const b = limites[z]
    const origin = `${((b.x + b.w / 2) / ancho) * 100}% ${((b.y + b.h / 2) / alto) * 100}%`
    return <img key={`zona-${z}`} className={`mapa-zona${(hover ?? zona) && z !== (hover ?? zona) ? ' atenuada' : ''}${hover === z ? ' levantada' : ''}`} style={{ transformOrigin: origin }} src={recortada ? zonasConVacios[z] ?? `/zones/zona${z}.png` : `/zones/zona${z}.png`} alt="" draggable="false" />
  }
  const renderComplementosZonaE = () => {
    const b = limites.E
    const origin = `${((b.x + b.w / 2) / ancho) * 100}% ${((b.y + b.h / 2) / alto) * 100}%`
    const zonaResaltada = hover ?? zona
    return <div className={`mapa-zona-e-contexto${hover === 'E' ? ' levantado' : ''}${zonaResaltada && zonaResaltada !== 'E' ? ' atenuada' : ''}`} style={{ transformOrigin: origin }} aria-hidden="true">
      {complementosZonaE.map((archivo) => <img key={archivo} src={`/zones/${encodeURIComponent(archivo)}`} alt="" draggable="false" />)}
    </div>
  }
  const renderEdificios = (zonaVisible?: Zona, omitir?: string) => listaEdificios.filter(({ id, zona: z }) => (!zonaVisible || z === zonaVisible) && id !== omitir).map(({ id, zona: z, archivo }) => {
    const edificioActivo = hoverEdificio ?? edificioSeleccionado
    const resaltado = zona !== null && edificioActivo === id
    const levantado = zona === null && hover === z
    const b = resaltado && limitesEdificios[id] ? limitesEdificios[id] : limites[z]
    const origin = `${((b.x + b.w / 2) / ancho) * 100}% ${((b.y + b.h / 2) / alto) * 100}%`
    const zonaResaltada = hover ?? zona
    return <img key={id} className={`mapa-edificio${(zonaResaltada && zonaResaltada !== z) || (zona !== null && edificioActivo && !resaltado) ? ' atenuada' : ''}${levantado ? ' levantado' : ''}${resaltado ? ' resaltado' : ''}`} style={{ transformOrigin: origin }} src={`${carpeta(z)}${encodeURIComponent(archivo)}`} alt="" draggable="false" />
  })
  const edificioEnfocado = listaEdificios.find(({ id }) => id === edificioSeleccionado)
  const boundsEdificio = edificioEnfocado ? limitesEdificios[edificioEnfocado.id] : undefined
  const escalaEdificio = boundsEdificio ? Math.min(12, 0.46 / (boundsEdificio.w / ancho), 0.58 / (boundsEdificio.h / alto)) : 1
  const centroEdificioX = boundsEdificio ? (boundsEdificio.x + boundsEdificio.w / 2) / ancho : 0.5
  const centroEdificioY = boundsEdificio ? (boundsEdificio.y + boundsEdificio.h / 2) / alto : 0.5
  const transformEdificio = `translate(${(0.5 - centroEdificioX * escalaEdificio) * 100}%, ${(0.5 - centroEdificioY * escalaEdificio) * 100}%) scale(${escalaEdificio})`

  return <div className="mapa-campus">
    <div className="mapa-controles">
      {edificioSeleccionado && <button type="button" onClick={() => { setEdificioSeleccionado(null); setHoverEdificio(null) }}><RotateCcw size={15} /> Vista de zona</button>}
      {zona && !edificioSeleccionado && <button type="button" onClick={() => { setZona(null); setZoom(1); setHoverEdificio(null); setEdificioSeleccionado(null); onSeleccionar(undefined) }}><RotateCcw size={15} /> Vista completa</button>}
      <button type="button" aria-label="Alejar mapa" onClick={() => setZoom((v) => Math.max(1, v - 0.2))}><Minus size={16} /></button>
      <button type="button" aria-label="Acercar mapa" onClick={() => setZoom((v) => Math.min(2, v + 0.2))}><Plus size={16} /></button>
    </div>
    {zona && <div className="mapa-etiqueta-zona">Zona {zona}</div>}
    <div className={`mapa-stage mapa-plano-completo${zona ? ' mapa-difuminado' : ''}`} style={{ transform: `translate(-50%, -50%) scale(${zona ? 1.025 : 1})` }} role="img" aria-label="Mapa interactivo del campus universitario" onMouseMove={(e) => {
      if (zona) return
      const zonaActual = zonaEnPunto(e)
      setHover(zonaActual)
      setHoverEdificio(null)
    }} onMouseLeave={() => { setHover(null); setHoverEdificio(null) }} onClick={(e) => {
      if (zona) return
      const seleccion = zonaEnPunto(e)
      if (seleccion) { setZona(seleccion); setZoom(1); onSeleccionar(undefined) }
      else onSeleccionar(undefined)
    }}>
      {zonas.map((z) => renderZona(z))}
      {renderEdificios()}
      {renderComplementosZonaE()}
      {posiciones.map(({ evento, x, y }) => <button key={evento.id} type="button" className="mapa-pin" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-label={`Ver ${evento.nombre}`} aria-pressed={seleccionado === evento.id} onClick={(e) => { e.stopPropagation(); onSeleccionar(evento.id) }}><PinMapa color={evento.categoria.color ?? '#950000'} seleccionado={seleccionado === evento.id} /></button>)}
    </div>
    {zona && <div className="mapa-focus-layer" aria-label={`Vista ampliada de la zona ${zona}`}>
      <div className={`mapa-stage mapa-stage-foco${edificioSeleccionado ? ' mapa-foco-difuminado' : ''}`} style={{ transform: `translate(-50%, -50%) ${transform}` }} onMouseMove={(e) => { if (!edificioSeleccionado) setHoverEdificio(edificioEnPunto(e, zona)) }} onMouseLeave={() => setHoverEdificio(null)} onClick={(e) => {
        if (edificioSeleccionado) return
        const edificio = edificioEnPunto(e, zona)
        if (edificio) setEdificioSeleccionado((actual) => actual === edificio ? null : edificio)
      }}>
        {renderZona(zona, true)}
        {renderEdificios(zona, edificioSeleccionado ?? undefined)}
        {zona === 'E' && renderComplementosZonaE()}
        {posiciones.filter((item) => item.zona === zona).map(({ evento, x, y }) => <button key={evento.id} type="button" className="mapa-pin" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-label={`Ver ${evento.nombre}`} aria-pressed={seleccionado === evento.id} onClick={(e) => { e.stopPropagation(); onSeleccionar(evento.id) }}><PinMapa color={evento.categoria.color ?? '#950000'} seleccionado={seleccionado === evento.id} /></button>)}
      </div>
      {edificioEnfocado && <div className="mapa-stage mapa-stage-edificio" style={{ transform: `translate(-50%, -50%) ${transformEdificio}` }} aria-label={`Edificación ${edificioEnfocado.id}`}>
        <img className="mapa-edificio-enfocado" src={`${carpeta(edificioEnfocado.zona)}${encodeURIComponent(edificioEnfocado.archivo)}`} alt={`Edificación ${edificioEnfocado.id}`} draggable="false" />
      </div>}
    </div>}
    {errorPlano && <p role="alert" className="mapa-error"><MapPin size={16} /> No se pudo cargar el plano del campus.</p>}
    <div className="mapa-pie"><span>⌖ Zonas A–E</span><span>Selecciona una zona para acercar</span><span>N ↑</span></div>
  </div>
}

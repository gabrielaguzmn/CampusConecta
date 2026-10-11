// Datos del plano del campus compartidos por el selector de ubicación (mismos valores que MapaCampus.tsx).
export const ancho = 1121
export const alto = 916
export const zonas = ['A', 'B', 'C', 'D', 'E'] as const
export type Zona = (typeof zonas)[number]
export type Rect = { x: number; y: number; w: number; h: number }
export type Lugar = { id: string; zona: Zona; src: string }

export const limitesZona: Record<Zona, Rect> = {
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
const carpeta = (z: Zona) => `/zone%20${z.toLowerCase()}%20builts/`

// Plazoletas de la zona E: son capas aparte en /zones/. El código debe coincidir con Ubicacion.codigo.
const plazoletas = [
  { archivo: 'zonaEPlazoletaCentral.svg', codigo: 'E:PlazoletaCentral' },
  { archivo: 'zonaEPHallDeLosPasosPerdidos.svg', codigo: 'E:HallDeLosPasosPerdidos' },
  { archivo: 'zonaEPlazoletaDeLasPalmeras.svg', codigo: 'E:PlazoletaDeLasPalmeras' },
  { archivo: 'zonaEPlazoletaIngenieriasl.svg', codigo: 'E:PlazoletaIngenierias' },
]

export const lugares: Lugar[] = [
  ...zonas.flatMap((zona) =>
    edificios[zona].map((archivo) => ({
      id: `${zona}:${archivo.replace(/-interactive(?=\.svg$)/, '').replace(/\.svg$/, '')}`,
      zona,
      src: `${carpeta(zona)}${encodeURIComponent(archivo)}`,
    })),
  ),
  ...plazoletas.map(({ archivo, codigo }) => ({ id: codigo, zona: 'E' as Zona, src: `/zones/${encodeURIComponent(archivo)}` })),
]
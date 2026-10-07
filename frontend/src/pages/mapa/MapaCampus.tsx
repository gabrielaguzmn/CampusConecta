import type { components } from '../../api/schema'

export type UbicacionMapa = components['schemas']['UbicacionMapa']

export type PropsMapaCampus = {
  /** Respuesta de GET /api/mapa/: eventos vigentes agrupados por ubicación del catálogo. */
  ubicaciones: UbicacionMapa[]
  /** Id del evento seleccionado; su pin lleva el halo (PinMapa con `seleccionado`). */
  seleccionado?: number
  /** Al tocar un pin, su evento; al tocar el fondo del mapa, `undefined`. */
  onSeleccionar: (eventoId: number | undefined) => void
}

// Punto de integración del mapa del campus (decisión 2026-10-07): la imagen y los pines los integra otro
// miembro del equipo con su propio código. Debe dibujar un PinMapa por evento (Figma 4:30135) con el color
// de su categoría, y la rosa "N" y la escala "━━ 50 m" (Figma 4:29322) si su mapa las tiene.
// TODO(PENDIENTE integración del mapa; G-01, G-02, G-48, CONTRATO-03)
export function MapaCampus(_props: PropsMapaCampus) {
  return null
}

import { useEffect, useState } from 'react'
import { alto, ancho, lugares, zonas, type Rect, type Zona } from './Campusdata'

type Punto = { x: number; y: number }
type Datos = { zonas: Partial<Record<Zona, Uint8Array>>; lugares: Record<string, Uint8Array>; limites: Record<string, Rect>; centros: Record<string, Punto> }

async function cargarMascara(src: string) {
  const img = new Image()
  img.src = src
  await new Promise<void>((ok, fallo) => { img.onload = () => ok(); img.onerror = () => fallo() })
  const canvas = document.createElement('canvas')
  canvas.width = ancho; canvas.height = alto
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(img, 0, 0, ancho, alto)
  const rgba = ctx.getImageData(0, 0, ancho, alto).data
  const mask = new Uint8Array(ancho * alto)
  let x0 = ancho, y0 = alto, x1 = 0, y1 = 0, sx = 0, sy = 0, n = 0
  for (let i = 0; i < mask.length; i += 1) {
    const a = rgba[i * 4 + 3]
    mask[i] = a
    if (a > 16) {
      const x = i % ancho, y = Math.floor(i / ancho)
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1)
      sx += x; sy += y; n += 1
    }
  }
  const centro = n > 0 ? { x: sx / n, y: sy / n } : { x: x0 + (x1 - x0) / 2, y: y0 + (y1 - y0) / 2 }
  return { mask, bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, centro }
}

// Las máscaras pesan; se cargan una sola vez por sesión aunque se abra el selector varias veces.
let cache: Promise<Datos> | null = null
function cargarTodo(): Promise<Datos> {
  cache ??= Promise.all([
    Promise.all(zonas.map(async (z) => [z, (await cargarMascara(`/zones/zona${z}.png`)).mask] as const)),
    Promise.all(lugares.map(async (l) => [l.id, await cargarMascara(l.src)] as const)),
  ]).then(([z, l]) => ({
    zonas: Object.fromEntries(z),
    lugares: Object.fromEntries(l.map(([id, d]) => [id, d.mask])),
    limites: Object.fromEntries(l.map(([id, d]) => [id, d.bounds])),
    centros: Object.fromEntries(l.map(([id, d]) => [id, d.centro])),
  })).catch((e) => { cache = null; throw e })
  return cache
}

export function useMascarasCampus() {
  const [datos, setDatos] = useState<Datos>()
  const [error, setError] = useState(false)
  useEffect(() => {
    let vigente = true
    cargarTodo().then((d) => vigente && setDatos(d)).catch(() => vigente && setError(true))
    return () => { vigente = false }
  }, [])
  return { datos, error }
}
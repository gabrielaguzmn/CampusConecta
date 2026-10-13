import { renderHook, waitFor } from '@testing-library/react'
import { alto, ancho, lugares } from './Campusdata'

// jsdom no carga imágenes ni dibuja en canvas: se simulan ambos.
// Cada máscara es opaca (alfa 255) solo en un rectángulo de 2×2 píxeles en (10, 20), así que su centro es (10.5, 20.5).
function simularPlano({ cargaOk = true, conCanvas = true } = {}) {
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_: string) {
        setTimeout(() => (cargaOk ? this.onload?.() : this.onerror?.()))
      }
    },
  )
  const rgba = new Uint8ClampedArray(ancho * alto * 4)
  for (const [x, y] of [[10, 20], [11, 20], [10, 21], [11, 21]]) rgba[(y * ancho + x) * 4 + 3] = 255
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => (conCanvas ? { drawImage: () => {}, getImageData: () => ({ data: rgba }) } : null) as never,
  )
}

// La caché del módulo dura toda la sesión: cada prueba importa una copia nueva.
async function usarMascaras() {
  vi.resetModules()
  const { useMascarasCampus } = await import('./Usemascarascampus')
  return renderHook(() => useMascarasCampus())
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useMascarasCampus (posición de los lugares del plano)', () => {
  it('calcula la máscara, los límites y el centro de cada lugar', async () => {
    simularPlano()
    const { result } = await usarMascaras()
    await waitFor(() => expect(result.current.datos).toBeDefined(), { timeout: 10000 })
    const { datos } = result.current
    const lugar = lugares[0].id
    expect(datos!.centros[lugar]).toEqual({ x: 10.5, y: 20.5 })
    expect(datos!.limites[lugar]).toEqual({ x: 10, y: 20, w: 2, h: 2 })
    expect(datos!.lugares[lugar][20 * ancho + 10]).toBe(255)
    expect(datos!.lugares[lugar][0]).toBe(0)
    expect(Object.keys(datos!.zonas)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(Object.keys(datos!.centros)).toHaveLength(lugares.length)
    expect(result.current.error).toBe(false)
  })

  it('si una imagen del plano no carga, informa el error', async () => {
    simularPlano({ cargaOk: false })
    const { result } = await usarMascaras()
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.datos).toBeUndefined()
  })

  it('si el navegador no tiene canvas, informa el error', async () => {
    simularPlano({ conCanvas: false })
    const { result } = await usarMascaras()
    await waitFor(() => expect(result.current.error).toBe(true))
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapaCampus, type UbicacionMapa } from './MapaCampus'

// El plano se dibuja con imágenes y canvas, que jsdom no procesa: se simulan las posiciones (centros) del catálogo.
vi.mock('../../lib/Usemascarascampus', () => ({
  useMascarasCampus: () => ({ datos: { zonas: {}, lugares: {}, limites: {}, centros: { 'E:E1': { x: 400, y: 500 } } }, error: false }),
}))

const categoria = { id: 1, nombre: 'Ventas', activa: true, color: '#E0E800' }
const ubicaciones = [
  {
    ubicacion: { id: 7, nombre: 'Edificio E1', codigo: 'E:E1', zona: 'E' },
    eventos: [
      { id: 1, nombre: 'Feria', categoria, detalle_ubicacion: '', fechas: [] },
      { id: 2, nombre: 'Taller', categoria, detalle_ubicacion: '', fechas: [] },
    ],
  },
  {
    // Ubicación sin código del plano: no se puede dibujar su pin.
    ubicacion: { id: 8, nombre: 'Edificio de prueba', codigo: null, zona: '' },
    eventos: [{ id: 3, nombre: 'Sin plano', categoria, detalle_ubicacion: '', fechas: [] }],
  },
] as unknown as UbicacionMapa[]

describe('MapaCampus (INTERACTIVITY-1, INTERACTIVITY-2 · criterio 1)', () => {
  it('dibuja un pin por evento en su ubicación del catálogo y al pulsarlo lo selecciona', async () => {
    const onSeleccionar = vi.fn()
    render(<MapaCampus ubicaciones={ubicaciones} seleccionado={2} onSeleccionar={onSeleccionar} />)
    const feria = screen.getByRole('button', { name: 'Ver Feria' })
    expect(screen.getByRole('button', { name: 'Ver Taller' })).toHaveAttribute('aria-pressed', 'true')
    expect(feria).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(feria)
    expect(onSeleccionar).toHaveBeenCalledWith(1)
  })

  it('INTERACTIVITY-1 · criterio 2: varios eventos en el mismo lugar no se tapan', () => {
    render(<MapaCampus ubicaciones={ubicaciones} onSeleccionar={vi.fn()} />)
    const izquierda = (nombre: string) => screen.getByRole('button', { name: `Ver ${nombre}` }).style.left
    expect(izquierda('Feria')).not.toBe(izquierda('Taller'))
  })

  it('un evento cuya ubicación no está en el plano no tiene pin', () => {
    render(<MapaCampus ubicaciones={ubicaciones} onSeleccionar={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Ver Sin plano' })).not.toBeInTheDocument()
  })

  it('si el plano no carga, lo avisa', async () => {
    // Imagen que siempre falla al cargar.
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_: string) {
          setTimeout(() => this.onerror?.())
        }
      },
    )
    render(<MapaCampus ubicaciones={[]} onSeleccionar={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el plano del campus.'))
    vi.unstubAllGlobals()
  })
})

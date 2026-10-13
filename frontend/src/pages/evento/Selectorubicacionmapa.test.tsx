import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { alto, ancho } from '../../lib/Campusdata'
import { CampoUbicacionMapa } from './Campoubicacionmapa'
import type { UbicacionCatalogo } from './Selectorubicacionmapa'

// El plano real se calcula con imágenes y canvas, que jsdom no dibuja: se simulan las máscaras.
// Un píxel (x, y) marcado como zona E y como edificio E1; otro marcado solo como E15 (sin ubicación en el catálogo).
const E1 = { x: 400, y: 500 }
const E15 = { x: 410, y: 500 }
const indice = ({ x, y }: { x: number; y: number }) => y * ancho + x
function mascara(...puntos: { x: number; y: number }[]) {
  const m = new Uint8Array(ancho * alto)
  for (const p of puntos) m[indice(p)] = 255
  return m
}
const estadoMascaras = vi.hoisted(() => ({ valor: { datos: undefined as unknown, error: false } }))
vi.mock('../../lib/Usemascarascampus', () => ({ useMascarasCampus: () => estadoMascaras.valor }))
const datosPlano = () => ({
  zonas: { E: mascara(E1, E15) },
  lugares: { 'E:E1': mascara(E1), 'E:E15': mascara(E15) },
  limites: {},
  centros: { 'E:E1': E1 },
})

const ubicaciones: UbicacionCatalogo[] = [
  { id: 7, nombre: 'Edificio E1', codigo: 'E:E1', zona: 'E' },
  { id: 8, nombre: 'Biblioteca', codigo: null, zona: '' },
]

function Formulario({ alCambiar = vi.fn() }: { alCambiar?: (id: number) => void }) {
  const [valor, setValor] = useState<number>()
  return <CampoUbicacionMapa ubicaciones={ubicaciones} value={valor} onChange={(id) => { setValor(id); alCambiar(id) }} />
}

// El escenario mide lo mismo que el plano: un clic en (x, y) cae en el píxel (x, y).
function clicEn(escenario: HTMLElement, p: { x: number; y: number }) {
  escenario.getBoundingClientRect = () => ({ left: 0, top: 0, width: ancho, height: alto, right: ancho, bottom: alto, x: 0, y: 0, toJSON: () => ({}) })
  fireEvent.click(escenario, { clientX: p.x + 0.5, clientY: p.y + 0.5 })
}

beforeEach(() => {
  estadoMascaras.valor = { datos: datosPlano(), error: false }
})

describe('Campo "Ubicación" (RF-009, PUBLICATION-1 · criterio 3)', () => {
  it('el select agrupa el catálogo por zona y guarda la ubicación elegida', async () => {
    const alCambiar = vi.fn()
    render(<Formulario alCambiar={alCambiar} />)
    const select = screen.getByLabelText('Ubicación *')
    expect(within(select).getByRole('group', { name: 'Zona E' })).toBeInTheDocument()
    expect(within(select).getByRole('group', { name: 'Otras' })).toBeInTheDocument()
    await userEvent.selectOptions(select, '8')
    expect(alCambiar).toHaveBeenCalledWith(8)
  })

  it('muestra el error del formulario', () => {
    render(<CampoUbicacionMapa ubicaciones={ubicaciones} onChange={vi.fn()} error="Elige una ubicación" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Elige una ubicación')
  })
})

describe('Elegir la ubicación en el mapa', () => {
  async function abrirMapa() {
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' }))
    const dialogo = screen.getByRole('dialog', { name: 'Elegir ubicación en el mapa' })
    return { dialogo, escenario: within(dialogo).getByRole('img', { name: /Mapa del campus/ }) }
  }

  it('primero se elige la zona y luego el edificio; el select queda con esa ubicación', async () => {
    const alCambiar = vi.fn()
    render(<Formulario alCambiar={alCambiar} />)
    const { dialogo, escenario } = await abrirMapa()
    expect(within(dialogo).getByRole('button', { name: 'Listo' })).toBeDisabled()

    clicEn(escenario, E1) // zona E
    expect(within(dialogo).getByText('Zona E')).toBeInTheDocument()
    expect(alCambiar).not.toHaveBeenCalled()

    clicEn(escenario, E1) // edificio E1
    expect(alCambiar).toHaveBeenCalledWith(7)
    expect(within(dialogo).getByText('Edificio E1')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Listo' })).toBeEnabled()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ubicación *')).toHaveValue('7')
  })

  it('un lugar del plano que no está en el catálogo no se puede elegir', async () => {
    const alCambiar = vi.fn()
    render(<Formulario alCambiar={alCambiar} />)
    const { escenario } = await abrirMapa()
    clicEn(escenario, E15)
    clicEn(escenario, E15)
    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('"Vista completa" vuelve a mostrar todas las zonas', async () => {
    render(<Formulario />)
    const { dialogo, escenario } = await abrirMapa()
    clicEn(escenario, E1)
    await userEvent.click(within(dialogo).getByRole('button', { name: /Vista completa/ }))
    expect(within(dialogo).queryByText('Zona E')).not.toBeInTheDocument()
    expect(within(dialogo).getByText('Toca una zona para acercar')).toBeInTheDocument()
  })

  it('mientras carga el plano lo indica, y si falla muestra un aviso', async () => {
    estadoMascaras.valor = { datos: undefined, error: false }
    const { unmount } = render(<Formulario />)
    const { dialogo } = await abrirMapa()
    expect(within(dialogo).getByText('Cargando mapa…')).toBeInTheDocument()
    unmount()

    estadoMascaras.valor = { datos: undefined, error: true }
    render(<Formulario />)
    const abierto = await abrirMapa()
    expect(within(abierto.dialogo).getByRole('alert')).toHaveTextContent('No se pudo cargar el plano del campus.')
  })
})

import { fireEvent, render as renderBase, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { evento, fecha } from '../test/datos'
import { TarjetaEvento } from './TarjetaEvento'

const render = (ui: ReactElement) => renderBase(<MemoryRouter>{ui}</MemoryRouter>)

describe('TarjetaEvento (Figma 4:30135 · 5:17–5:18)', () => {
  it('muestra imagen, categoría sobre la imagen, título y descripción', () => {
    render(<TarjetaEvento evento={evento()} />)
    expect(screen.getByRole('heading', { name: 'Evento de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Categoría de prueba')).toBeInTheDocument()
    expect(screen.getByText('Descripción de prueba')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://example.test/imagen.jpg')
  })

  it('con una sola fecha muestra su badge de estado y "día · horario"', () => {
    render(<TarjetaEvento evento={evento()} />)
    expect(screen.getByText('Próximo')).toBeInTheDocument()
    expect(screen.getByText('20 Oct. · 11:00–16:00')).toBeInTheDocument()
  })

  it('con varias fechas las muestra en Sesiones y sin badge', () => {
    const fechas = [
      fecha(1, 'en_vivo', '2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z'),
      fecha(2, 'proxima', '2026-10-24T21:00:00Z', '2026-10-24T23:00:00Z'),
    ]
    render(<TarjetaEvento evento={evento({ fechas })} />)
    expect(screen.getByText('Sesiones')).toBeInTheDocument()
    expect(screen.queryByText('Próximo')).not.toBeInTheDocument()
  })

  it('INTERACTIVITY-3 · criterio 2: sin detalle de ubicación no inventa uno', () => {
    render(<TarjetaEvento evento={evento()} />)
    expect(screen.getByText('Ubicación de prueba')).toBeInTheDocument()
  })

  it('une detalle de ubicación y ubicación del catálogo como en Figma', () => {
    render(<TarjetaEvento evento={evento({ detalle_ubicacion: 'Detalle de prueba' })} />)
    expect(screen.getByText('Detalle de prueba · Ubicación de prueba')).toBeInTheDocument()
  })
})

describe('TarjetaEvento sin imagen (G-55, decisión 2026-10-11)', () => {
  it('el bloque toma el color de la categoría y la categoría sigue visible', () => {
    const categoria = { id: 1, nombre: 'Ventas', activa: true, color: '#E0E800' }
    const { container } = render(<TarjetaEvento evento={evento({ imagen: null, categoria })} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.bg-primario')).toBeNull()
    expect(container.querySelector('.h-40')).toHaveStyle({ backgroundColor: '#E0E800' })
    expect(screen.getByText('Ventas')).toBeInTheDocument()
  })

  it('si la categoría no tiene color, queda en rojo Primario', () => {
    const { container } = render(<TarjetaEvento evento={evento({ imagen: null })} />)
    expect(container.querySelector('.bg-primario')).toBeInTheDocument()
  })

  it('con imagen, el color queda detrás; si la imagen no carga, se oculta y se ve el color', () => {
    const categoria = { id: 1, nombre: 'Ventas', activa: true, color: '#E0E800' }
    const { container } = render(<TarjetaEvento evento={evento({ categoria })} />)
    expect(container.querySelector('.h-40')).toHaveStyle({ backgroundColor: '#E0E800' })
    const imagen = container.querySelector('img')!
    expect(imagen).toBeVisible()
    fireEvent.error(imagen)
    expect(imagen).not.toBeVisible()
  })
})

describe('TarjetaEvento enlaza al detalle (INTERACTIVITY-2 · criterio 2)', () => {
  it('el título es un enlace a /eventos/:id', () => {
    render(<TarjetaEvento evento={evento({ id: 42 })} />)
    expect(screen.getByRole('link', { name: 'Evento de prueba' })).toHaveAttribute('href', '/eventos/42')
  })
})

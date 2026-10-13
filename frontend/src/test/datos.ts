import type { components } from '../api/schema'

// Datos de prueba: solo para las pruebas, nunca en la interfaz (regla 2).
type Evento = components['schemas']['Evento']
type Fecha = components['schemas']['Fecha']

export function fecha(id: number, estado: Fecha['estado'], inicio: string, fin: string): Fecha {
  return { id, estado, inicio, fin }
}

export function evento(cambios: Partial<Evento> = {}): Evento {
  return {
    id: 1,
    nombre: 'Evento de prueba',
    categoria: { id: 1, nombre: 'Categoría de prueba' },
    descripcion: 'Descripción de prueba',
    responsable: 'Responsable de prueba',
    ubicacion: { id: 1, nombre: 'Ubicación de prueba' },
    imagen: 'https://example.test/imagen.jpg',
    fechas: [fecha(1, 'proxima', '2026-10-20T16:00:00Z', '2026-10-20T21:00:00Z')],
    ...cambios,
  }
}

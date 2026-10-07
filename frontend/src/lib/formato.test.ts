import { formatoDia, formatoDiaYHorario, formatoHorario } from './formato'

describe('formato de fechas (Figma 4:30135, G-15)', () => {
  it('muestra el día con dos dígitos y el mes abreviado como en Figma', () => {
    expect(formatoDia('2026-10-17T21:00:00Z')).toBe('17 Oct.')
    expect(formatoDia('2026-10-03T20:00:00Z')).toBe('03 Oct.')
    expect(formatoDia('2026-09-28T22:00:00Z')).toBe('28 Sep.')
  })

  it('usa la hora de America/Bogota', () => {
    // 02:00 UTC del 18 es 21:00 del 17 en Bogotá
    expect(formatoDia('2026-10-18T02:00:00Z')).toBe('17 Oct.')
    expect(formatoHorario('2026-10-17T21:00:00Z', '2026-10-17T23:00:00Z')).toBe('16:00–18:00')
  })

  it('combina día y horario con el separador de Figma', () => {
    expect(formatoDiaYHorario('2026-10-20T16:00:00Z', '2026-10-20T21:00:00Z')).toBe('20 Oct. · 11:00–16:00')
  })
})

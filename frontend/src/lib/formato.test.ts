import { formatoDia, formatoDiaYHorario, formatoHorario, formatoMesActual, isoALocal, localAIso } from './formato'

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

describe('G-58: mes actual del resumen del Feed', () => {
  it('muestra el mes y el año como en Figma ("Octubre 2026"), en hora de Bogotá', () => {
    expect(formatoMesActual(new Date('2026-10-07T12:00:00Z'))).toBe('Octubre 2026')
    // 1 de noviembre a las 02:00 UTC todavía es 31 de octubre en Bogotá
    expect(formatoMesActual(new Date('2026-11-01T02:00:00Z'))).toBe('Octubre 2026')
  })
})

describe('fechas de formulario en hora de Bogotá (G-15)', () => {
  it('convierte entre datetime-local y el instante ISO', () => {
    expect(new Date(localAIso('2026-10-17T16:00')).toISOString()).toBe('2026-10-17T21:00:00.000Z')
    expect(isoALocal('2026-10-17T21:00:00Z')).toBe('2026-10-17T16:00')
  })
})

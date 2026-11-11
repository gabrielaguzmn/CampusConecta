import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comandoDicho, interpretarRespuesta, type CatalogItem } from './voiceInterpreter'

vi.stubEnv('TZ', 'America/Bogota')
afterAll(() => vi.unstubAllEnvs())

const categorias: CatalogItem[] = [
  { id: 2, nombre: 'Talleres' },
  { id: 3, nombre: 'Música' },
]
const ubicaciones: CatalogItem[] = [
  { id: 7, nombre: 'Biblioteca Central' },
  { id: 8, nombre: 'Biblioteca del Campus' },
]

describe('interpretarRespuesta: respuestas guiadas', () => {
  it.each([
    ['nombre', 'El nombre es Feria de emprendimiento', 'Feria de emprendimiento'],
    ['descripcion', 'Descripción: Actividad para estudiantes', 'Actividad para estudiantes'],
    ['responsable', 'Organiza Club de ciencia', 'Club de ciencia'],
    ['detalle_ubicacion', 'Ubicación exacta: Sala norte', 'Sala norte'],
    ['cupo', 'Cupo: tres', '3'],
    ['enlace_externo', 'Enlace: https://example.test/feria', 'https://example.test/feria'],
  ] as const)('interpreta %s sin conservar su etiqueta', (paso, texto, valor) => {
    expect(interpretarRespuesta(paso, texto)).toMatchObject({ tipo: 'texto', valor })
  })

  it('rechaza cupos que no son enteros positivos', () => {
    expect(interpretarRespuesta('cupo', 'Cupo: cero')).toMatchObject({ tipo: 'error', mensaje: expect.stringMatching(/cupo/i) })
    expect(interpretarRespuesta('cupo', 'Cupo: -2')).toMatchObject({ tipo: 'error', mensaje: expect.stringMatching(/cupo/i) })
  })

  it('interpreta contacto telefónico y correo dicho en voz alta', () => {
    expect(interpretarRespuesta('contacto', 'Contacto: 3001234567'))
      .toMatchObject({ tipo: 'texto', valor: '3001234567' })
    expect(interpretarRespuesta('contacto', 'juan arroba correo punto com'))
      .toMatchObject({ tipo: 'texto', valor: 'juan@correo.com' })
  })

  it('combina un número de contacto dicho en varias partes', () => {
    const parcial = interpretarRespuesta('contacto', '300 123')
    expect(parcial).toMatchObject({ tipo: 'incompleto', pendiente: '300123' })
    expect(interpretarRespuesta('contacto', '4567', { pendiente: parcial.tipo === 'incompleto' ? parcial.pendiente : undefined }))
      .toMatchObject({ tipo: 'texto', valor: '3001234567' })
  })

  it('convierte un enlace dictado con “punto” y “barra”', () => {
    expect(interpretarRespuesta('enlace_externo', 'forms punto gle barra feria'))
      .toMatchObject({ tipo: 'texto', valor: 'https://forms.gle/feria' })
  })

  it('resuelve una categoría del catálogo sin distinguir tildes', () => {
    expect(interpretarRespuesta('categoria', 'Categoría: MUSICA', { categorias }))
      .toEqual({ tipo: 'catalogo', id: 3, nombre: 'Música' })
  })

  it('resuelve una selección ordinal entre opciones ofrecidas', () => {
    expect(interpretarRespuesta('ubicacion', 'La segunda', { ubicaciones, opciones: ubicaciones }))
      .toEqual({ tipo: 'catalogo', id: 8, nombre: 'Biblioteca del Campus' })
  })

  it('devuelve opciones cuando la ubicación es ambigua', () => {
    expect(interpretarRespuesta('ubicacion', 'Biblioteca', { ubicaciones }))
      .toEqual({ tipo: 'opciones', opciones: ubicaciones })
  })

  it('reconoce sí y no al preguntar por otra fecha', () => {
    expect(interpretarRespuesta('otraFecha', 'Sí')).toEqual({ tipo: 'si' })
    expect(interpretarRespuesta('otraFecha', 'No')).toEqual({ tipo: 'no' })
  })

  it('reconoce comandos de control únicamente como respuesta completa', () => {
    expect(comandoDicho('Omitir')).toBe('omitir')
    expect(comandoDicho('Crear evento')).toBe('publicar')
    expect(comandoDicho('Ayuda')).toBe('ayuda')
    expect(comandoDicho('Quisiera crear evento para estudiantes')).toBeUndefined()
  })
})

describe('interpretarRespuesta: fechas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T12:00:00-05:00'))
  })

  afterEach(() => vi.useRealTimers())

  it('interpreta una fecha y su horario en hora local', () => {
    expect(interpretarRespuesta(
      'fecha',
      'El 16 de diciembre de 2026 a las 3 de la tarde hasta las 5 de la tarde',
    )).toEqual({
      tipo: 'fecha',
      fecha: { inicio: '2026-12-16T15:00', fin: '2026-12-16T17:00' },
    })
  })

  it('pide completar el horario cuando falta', () => {
    expect(interpretarRespuesta('fecha', 'El 16 de diciembre de 2026'))
      .toMatchObject({ tipo: 'incompleto', mensaje: expect.stringMatching(/hora/i) })
  })

  it('rechaza fechas pasadas', () => {
    expect(interpretarRespuesta('fecha', 'El 9 de noviembre de 2026 a las 2 pm hasta las 3 pm'))
      .toMatchObject({ tipo: 'error', mensaje: expect.stringMatching(/fecha futura/i) })
  })

  it('interpreta el rango de tarde aplicando la franja a ambas horas', () => {
    expect(interpretarRespuesta('fecha', 'El 16 de diciembre de 2027 de 2 a 5 de la tarde'))
      .toMatchObject({
        tipo: 'fecha',
        fecha: { inicio: '2027-12-16T14:00', fin: '2027-12-16T17:00' },
      })
  })

  it('rechaza un horario cuyo fin es anterior al inicio', () => {
    expect(interpretarRespuesta('fecha', 'El 16 de diciembre de 2027 a las 5 pm hasta las 2 pm'))
      .toMatchObject({ tipo: 'error', mensaje: expect.stringMatching(/fin.*posterior|horario.*válido/i) })
  })

  it('acepta otra fecha después de responder afirmativamente', () => {
    expect(interpretarRespuesta(
      'otraFecha',
      'El 18 de diciembre de 2026 a las 3 pm hasta las 5 pm',
    )).toEqual({
      tipo: 'fecha',
      fecha: { inicio: '2026-12-18T15:00', fin: '2026-12-18T17:00' },
    })
  })
})

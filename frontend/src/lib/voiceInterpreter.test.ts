import { afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { interpretarVoz, type CatalogItem } from './voiceInterpreter'

vi.stubEnv('TZ', 'America/Bogota')
afterAll(() => vi.unstubAllEnvs())

const categorias: CatalogItem[] = [
  { id: 2, nombre: 'Talleres' },
  { id: 3, nombre: 'Música' },
  { id: 4, nombre: 'Talleres de cerámica', },
]
const categoriasActivas = categorias.slice(0, 2)
const ubicaciones: CatalogItem[] = [
  { id: 7, nombre: 'Edificio B13' },
  { id: 8, nombre: 'Biblioteca Central' },
  { id: 9, nombre: 'Biblioteca del Campus' },
]

describe('interpretarVoz: campos y catálogos', () => {
  it.each([
    ['nombre', 'El nombre es Feria de emprendimiento', 'Feria de emprendimiento'],
    ['descripcion', 'Descripción: Actividad para aprender', 'Actividad para aprender'],
    ['responsable', 'Organiza Club de ciencia', 'Club de ciencia'],
    ['detalle_ubicacion', 'Ubicación exacta: Sala norte', 'Sala norte'],
    ['cupo', 'Capacidad: cinco', '5'],
    ['contacto', 'Contacto: 3001234567', '3001234567'],
    ['enlace_externo', 'Link: https://example.test/feria', 'https://example.test/feria'],
  ] as const)('interpreta el campo %s', (campo, frase, valor) => {
    expect(interpretarVoz(frase, categoriasActivas, ubicaciones).fields[campo]).toBe(valor)
  })

  it('reconoce sinónimos de título, responsable, cupo y enlace', () => {
    const resultado = interpretarVoz(
      'Título: Feria. Responsable: Club. Cupo: tres. Enlace: https://example.test',
      categoriasActivas,
      ubicaciones,
    )
    expect(resultado.fields).toMatchObject({
      nombre: 'Feria',
      responsable: 'Club',
      cupo: '3',
      enlace_externo: 'https://example.test',
    })
  })

  it('extrae varios campos de una sola instrucción', () => {
    const resultado = interpretarVoz(
      'Nombre: Feria. Descripción: Para estudiantes. Organiza Club de ciencia. Contacto: 3001234567.',
      categoriasActivas,
      ubicaciones,
    )
    expect(resultado.fields).toMatchObject({
      nombre: 'Feria',
      descripcion: 'Para estudiantes',
      responsable: 'Club de ciencia',
      contacto: '3001234567',
    })
  })

  it('aplica una corrección hablada de título al nombre', () => {
    expect(interpretarVoz('Cambia el título a Feria nueva', categoriasActivas, ubicaciones).fields.nombre)
      .toBe('Feria nueva')
  })

  it.each([
    ['cero', 'Cupo: 0'],
    ['negativo', 'Cupo: -2'],
  ])('rechaza cupo %s', (_tipo, frase) => {
    const resultado = interpretarVoz(frase, categoriasActivas, ubicaciones)
    expect(resultado.fields).not.toHaveProperty('cupo')
    expect(resultado.messages.join(' ')).toMatch(/cupo/i)
  })

  it('convierte cupo expresado en palabras', () => {
    expect(interpretarVoz('Cupo: tres', categoriasActivas, ubicaciones).fields.cupo).toBe('3')
  })

  it('no inventa campos ante una frase irrelevante', () => {
    const resultado = interpretarVoz('Qué bonito está el día', categoriasActivas, ubicaciones)
    expect(resultado.fields).toEqual({})
    expect(resultado.messages.join(' ')).toMatch(/no entendí/i)
  })

  it('reconoce categorías exactas, sin distinguir tildes ni mayúsculas', () => {
    expect(interpretarVoz('Categoría: talleres', categoriasActivas, ubicaciones).categoria).toBe(2)
    expect(interpretarVoz('Categoría: MUSICA', categoriasActivas, ubicaciones).categoria).toBe(3)
  })

  it('no incluye una categoría inactiva que el formulario excluye del catálogo', () => {
    const inactiva = { id: 99, nombre: 'Deportes' }
    expect(interpretarVoz(`Categoría: ${inactiva.nombre}`, categoriasActivas, ubicaciones).categoria).toBeUndefined()
    expect(categoriasActivas).not.toContainEqual(inactiva)
  })

  it('resuelve ubicación exacta y código de edificio separado', () => {
    expect(interpretarVoz('Ubicación: Edificio B13', categoriasActivas, ubicaciones).ubicacion).toBe(7)
    expect(interpretarVoz('Ubicación: Edificio B 13', categoriasActivas, ubicaciones).ubicacion).toBe(7)
  })

  it('reporta ubicaciones ambiguas sin seleccionar una', () => {
    const resultado = interpretarVoz('Ubicación: Biblioteca', categoriasActivas, ubicaciones)
    expect(resultado.ambiguousUbicaciones).toEqual([ubicaciones[1], ubicaciones[2]])
    expect(resultado.ubicacion).toBeUndefined()
  })

  it('informa que la ubicación mencionada no pertenece al catálogo', () => {
    const resultado = interpretarVoz('Ubicación: Auditorio inexistente', categoriasActivas, ubicaciones)
    expect(resultado.ubicacion).toBeUndefined()
    expect(resultado.messages.join(' ')).toMatch(/no está en el catálogo/i)
  })
})

describe('interpretarVoz: fechas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T12:00:00-05:00'))
  })

  afterEach(() => vi.useRealTimers())

  it('interpreta día y mes y usa el año actual cuando no se especifica', () => {
    expect(interpretarVoz('Fecha: el 16 de diciembre a las 3 de la tarde hasta las 5 de la tarde', [], []).date)
      .toEqual({ inicio: '2026-12-16T15:00', fin: '2026-12-16T17:00' })
  })

  it('interpreta un año explícito', () => {
    expect(interpretarVoz('Fecha: el 16 de diciembre de 2027 a las 3 pm hasta las 5 pm', [], []).date?.inicio)
      .toBe('2027-12-16T15:00')
  })

  it('interpreta mañana con hora local de Bogotá', () => {
    expect(interpretarVoz('Mañana a las 10 de la mañana hasta las 11 de la mañana', [], []).date)
      .toEqual({ inicio: '2026-11-11T10:00', fin: '2026-11-11T11:00' })
  })

  it('interpreta el rango «de 2 a 5 de la tarde»', () => {
    expect(interpretarVoz('El 16 de diciembre de 2026 de 2 a 5 de la tarde', [], []).date)
      .toEqual({ inicio: '2026-12-16T14:00', fin: '2026-12-16T17:00' })
  })

  it('reconoce «hasta» como hora de fin', () => {
    expect(interpretarVoz('El 16 de diciembre de 2026 a las 2 pm hasta las 5 pm', [], []).date)
      .toEqual({ inicio: '2026-12-16T14:00', fin: '2026-12-16T17:00' })
  })

  it.each([
    ['am', 'a las 9 am', '09:00'],
    ['pm', 'a las 3 pm', '15:00'],
  ])('interpreta horario %s', (_nombre, horario, inicio) => {
    expect(interpretarVoz(`El 16 de diciembre de 2026 ${horario}`, [], []).date?.inicio)
      .toBe(`2026-12-16T${inicio}`)
  })

  it('interpreta dos fechas separadas por «segunda fecha»', () => {
    const resultado = interpretarVoz(
      'El 16 de diciembre de 2026 a las 2 pm hasta las 3 pm; segunda fecha el 18 de diciembre de 2026 a las 2 pm hasta las 3 pm',
      [],
      [],
    )
    expect(resultado.dates).toEqual([
      { inicio: '2026-12-16T14:00', fin: '2026-12-16T15:00' },
      { inicio: '2026-12-18T14:00', fin: '2026-12-18T15:00' },
    ])
  })

  it('no agrega una fecha cuando falta la hora y pide completar inicio y fin', () => {
    const resultado = interpretarVoz('Fecha: el 16 de diciembre de 2026', [], [])
    expect(resultado.date).toBeUndefined()
    expect(resultado.dates).toEqual([])
    expect(resultado.messages.join(' ')).toMatch(/indica también la hora/i)
  })

  it('rechaza un fin anterior al inicio', () => {
    const resultado = interpretarVoz('El 16 de diciembre de 2026 a las 5 pm hasta las 2 pm', [], [])
    expect(resultado.date).toBeUndefined()
    expect(resultado.messages.join(' ')).toMatch(/fin.*posterior|horario.*válido/i)
  })

  it('no agrega fechas pasadas', () => {
    const resultado = interpretarVoz('El 9 de noviembre de 2026 a las 2 pm hasta las 3 pm', [], [])
    expect(resultado.date).toBeUndefined()
    expect(resultado.messages.join(' ')).toMatch(/fecha futura/i)
  })
})

describe('interpretarVoz: comando de publicación', () => {
  it.each(['Crear evento', 'Crea el evento', 'Publicar evento', 'Publica el evento'])(
    'detecta la frase «%s» sin publicar por sí sola',
    (frase) => {
      expect(interpretarVoz(frase, [], []).crearEvento).toBe(true)
    },
  )

  it('no identifica una orden ajena a la creación del evento', () => {
    expect(interpretarVoz('Ayúdame con el formulario', [], []).crearEvento).toBe(false)
  })
})

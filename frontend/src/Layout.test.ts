import { iniciales } from './Layout'

describe('iniciales del avatar (Figma 4:30135 · Navegación, "LM")', () => {
  it('toma la primera letra de las dos primeras palabras del nombre', () => {
    expect(iniciales('lucía martínez gómez')).toBe('LM')
    expect(iniciales('  Ana ')).toBe('A')
  })
})

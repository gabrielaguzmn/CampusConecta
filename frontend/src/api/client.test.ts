import { tokens } from '../auth/tokens'
import { json, simularApi } from '../test/app'
import { api } from './client'

describe('cliente de la API: renovación de la sesión (02_arquitectura.md §3)', () => {
  it('ante un 401 renueva el access con el refresh y repite la petición', async () => {
    tokens.guardar({ access: 'vencido', refresh: 'refresco-1' })
    let intentos = 0
    const peticiones = simularApi({
      'GET /api/auth/yo/': () => (++intentos === 1 ? json({}, 401) : json({ id: 1, nombre: 'A', email: 'a@b.test' })),
      'POST /api/auth/token/refresh/': () => json({ access: 'nuevo' }),
    })
    const { data } = await api.GET('/api/auth/yo/')
    expect(data?.nombre).toBe('A')
    expect(peticiones.at(-1)!.headers.get('Authorization')).toBe('Bearer nuevo')
  })

  it('si el refresh también falla, cierra la sesión', async () => {
    tokens.guardar({ access: 'vencido', refresh: 'refresco-vencido' })
    const alCerrarse = vi.fn()
    const quitar = tokens.alCerrarse(alCerrarse)
    simularApi({
      'GET /api/auth/yo/': () => json({}, 401),
      'POST /api/auth/token/refresh/': () => json({}, 401),
    })
    await api.GET('/api/auth/yo/')
    expect(tokens.access()).toBeNull()
    expect(tokens.refresh()).toBeNull()
    expect(alCerrarse).toHaveBeenCalled()
    quitar()
  })
})

import { describe, expect, it } from 'vitest'
import type { Intent, Page } from './assistantTypes'
import { executeIntent, type NavigationAdapter } from './actionRegistry'
import { interpret, normalizeText } from './intentRecognizer'

const pages: readonly Page[] = ['MAP', 'FEED', 'MY_EVENTS', 'CREATE_EVENT']
const cases: ReadonlyArray<{ intent: Intent; phrases: readonly string[] }> = [
  { intent: 'OPEN_MAP', phrases: [
    'Abre el mapa', 'Ve al mapa', 'Muéstrame el mapa', 'Quiero consultar el mapa',
    'Quiero ver dónde están los eventos', '¿Dónde puedo encontrar los eventos?', 'Llévame a la sección del mapa',
    'Vamos al mapa', 'Abre la pestaña de ubicación', 'Vuelve al mapa',
    'por favor, ábreme el mapa', 'Oye ve al mapa', 'muestrame el mapa', 'consulta la ubicación de los eventos', 'eh, vamos al mapa',
  ] },
  { intent: 'OPEN_FEED', phrases: [
    'Abre el Feed', 'Ve al Feed', 'Muéstrame los eventos', 'Quiero consultar los eventos',
    'Quiero ver qué actividades hay', 'Enséñame las publicaciones', 'Llévame a la lista de eventos',
    'Abre la sección de eventos', 'Quiero explorar las actividades', 'Vuelve al Feed',
    'por favor abre el feed', 'Oye, muestrame los eventos', 'consulta las publicaciones', 'quiero ver todos los eventos', 'eh abre la seccion de eventos',
  ] },
  { intent: 'OPEN_MY_EVENTS', phrases: [
    'Abre Mis eventos', 'Ve a mis eventos', 'Muéstrame mis publicaciones', 'Quiero consultar mis eventos',
    '¿Qué eventos he creado?', 'Muéstrame lo que he publicado', 'Quiero ver mi historial', 'Muéstrame mis eventos activos',
    'por favor abre mis eventos', 'Oye muestrame mis publicaciones', 'consulta mi historial', 'que eventos he creado', 'eh, mis eventos',
  ] },
  { intent: 'CREATE_EVENT', phrases: [
    'Quiero crear un evento', 'Crea un evento', 'Necesito registrar una actividad', 'Abre el formulario de eventos',
    'por favor crear un evento', 'Oye publica un evento', 'organizar una actividad', 'anunciar un evento', 'agregar un evento',
  ] },
]

describe('interpret', () => {
  it.each(cases.flatMap(({ intent, phrases }) => pages.flatMap((currentPage) => phrases.map((phrase) => ({ intent, phrase, currentPage })))))
  ('recognizes $intent from $currentPage: $phrase', ({ intent, phrase, currentPage }) => {
    expect(interpret(phrase, { currentPage }).intent).toBe(intent)
  })

  it('normalizes accents, punctuation, spaces and filler words', () => {
    expect(normalizeText(' Oye,  por favor: Muéstrame   el MAPA! ')).toBe('muestrame el mapa')
  })

  it('prioritizes event creation over feed wording', () => {
    expect(interpret('Quiero crear un evento con publicaciones', { currentPage: 'FEED' }).intent).toBe('CREATE_EVENT')
  })

  it('prioritizes possessives over generic publications', () => {
    expect(interpret('mis publicaciones', { currentPage: 'FEED' }).intent).toBe('OPEN_MY_EVENTS')
    expect(interpret('las publicaciones', { currentPage: 'MAP' }).intent).toBe('OPEN_FEED')
  })

  it('returns UNKNOWN for unrelated text', () => {
    expect(interpret('las nubes cantan azul', { currentPage: 'MAP' }).intent).toBe('UNKNOWN')
  })
})

describe('executeIntent', () => {
  it('does not navigate when the requested page is already current', () => {
    const adapter: NavigationAdapter = { getCurrentPage: () => 'FEED', goTo: vi.fn() }
    const result = executeIntent('OPEN_FEED', adapter)
    expect(result.navigated).toBe(false)
    expect(adapter.goTo).not.toHaveBeenCalled()
    expect(result.response).toBe('Ya estás en el Feed.')
  })

  it('uses the injected adapter to navigate', () => {
    const goTo = vi.fn()
    const adapter: NavigationAdapter = { getCurrentPage: () => 'MAP', goTo }
    expect(executeIntent('OPEN_MY_EVENTS', adapter)).toMatchObject({ navigated: true })
    expect(goTo).toHaveBeenCalledWith('MY_EVENTS')
  })

  it('does not navigate for reserved creation or unknown commands', () => {
    const goTo = vi.fn()
    const adapter: NavigationAdapter = { getCurrentPage: () => 'FEED', goTo }
    expect(executeIntent('CREATE_EVENT', adapter).response).toBe('La creación de eventos por voz estará disponible pronto.')
    expect(executeIntent('UNKNOWN', adapter).navigated).toBe(false)
    expect(goTo).not.toHaveBeenCalled()
  })
})

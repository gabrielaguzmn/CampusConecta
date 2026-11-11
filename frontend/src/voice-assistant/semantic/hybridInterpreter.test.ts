import { describe, expect, it, vi } from 'vitest'
import { interpretAsync } from './hybridInterpreter'
import type { SemanticMatcher, SemanticResult } from './SemanticMatcher'

const context = { currentPage: 'FEED' as const }
const semantic = (result: SemanticResult): SemanticMatcher => ({ match: vi.fn().mockResolvedValue(result) })

describe('interpretAsync', () => {
  it('does not call semantic matching when rules recognize a command', async () => {
    const service = semantic({ decision: 'accept', intent: 'OPEN_MAP', candidates: [] })
    await expect(interpretAsync('abre el mapa', context, service)).resolves.toMatchObject({ intent: 'OPEN_MAP', source: 'rules' })
    expect(service.match).not.toHaveBeenCalled()
  })
  it('accepts a semantic fallback and sends page and candidates', async () => {
    const service = semantic({ decision: 'accept', intent: 'OPEN_FEED', score: .78, candidates: [] })
    await expect(interpretAsync('qué hay para hacer hoy', context, service)).resolves.toMatchObject({ intent: 'OPEN_FEED', source: 'semantic' })
    expect(service.match).toHaveBeenCalledWith('qué hay para hacer hoy', 'FEED', expect.arrayContaining(['OPEN_FEED']))
  })
  it('preserves a suggestion without executing an intent', async () => {
    const service = semantic({ decision: 'suggest', intent: 'OPEN_MY_EVENTS', candidates: [] })
    await expect(interpretAsync('quiero mirar lo mío', context, service)).resolves.toMatchObject({ intent: 'UNKNOWN', suggestion: { intent: 'OPEN_MY_EVENTS' } })
  })
  it('falls back to unknown on none or service errors', async () => {
    await expect(interpretAsync('palabras sin sentido', context, semantic({ decision: 'none', candidates: [] }))).resolves.toMatchObject({ intent: 'UNKNOWN' })
    await expect(interpretAsync('palabras sin sentido', context, { match: vi.fn().mockRejectedValue(new Error('503')) })).resolves.toMatchObject({ intent: 'UNKNOWN' })
  })
})

import { describe, expect, it } from 'vitest'
import { interpretConfirmation } from './confirmation'

describe('interpretConfirmation', () => {
  it.each(['sí', 'Si por favor', 'dale', 'correcto', 'hazlo'])('accepts %s', (text) => expect(interpretConfirmation(text)).toBe('accept'))
  it.each(['no', 'cancelar', 'olvídalo', 'mejor no'])('rejects %s', (text) => expect(interpretConfirmation(text)).toBe('reject'))
  it('does not treat another command as confirmation', () => expect(interpretConfirmation('abre el mapa')).toBe('unknown'))
})

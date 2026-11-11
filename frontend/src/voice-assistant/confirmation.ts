import { normalizeText } from './intentRecognizer'

export type Confirmation = 'accept' | 'reject' | 'unknown'

const ACCEPT = new Set(['si', 'si por favor', 'dale', 'correcto', 'hazlo', 'confirmo', 'de acuerdo'])
const REJECT = new Set(['no', 'no gracias', 'cancelar', 'cancelalo', 'olvidalo', 'mejor no'])

/** Intentionally deterministic: confirmations never go through semantic matching. */
export function interpretConfirmation(text: string): Confirmation {
  const normalized = normalizeText(text)
  if (ACCEPT.has(normalized)) return 'accept'
  if (REJECT.has(normalized)) return 'reject'
  return 'unknown'
}

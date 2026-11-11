import type { AssistantContext, Intent, IntentResult } from './assistantTypes'
import { INTENT_RULES } from './catalogs/intents'

const FILLER_WORDS = /\b(por favor|oye|eh|em|hola asistente)\b/g

export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase('es-CO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(FILLER_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matches(text: string, alias: string): boolean {
  return text.includes(alias)
}

/** Pure, DOM-free intent recognition. Context is deliberately part of its public contract for later stages. */
export function interpret(text: string, _context: AssistantContext): IntentResult {
  const normalizedText = normalizeText(text)
  const matchesByPriority = INTENT_RULES.map((rule) => ({
    intent: rule.intent,
    count: rule.aliases.filter((alias) => matches(normalizedText, alias)).length,
  })).filter((candidate) => candidate.count > 0)

  // The catalog is ordered deliberately, so equal alias counts are resolved by its priority.
  const candidate = matchesByPriority[0]
  const intent: Intent = candidate?.intent ?? 'UNKNOWN'

  return {
    intent,
    entities: {},
    confidence: candidate ? 1 : 0,
    normalizedText,
    ambiguous: false,
  }
}
